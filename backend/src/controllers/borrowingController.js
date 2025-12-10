const { query, transaction } = require('../config/db');
const { deleteCachePattern } = require('../config/redis');

// Create borrowing (Member pinjam buku)
const createBorrowing = async (req, res, next) => {
  try {
    const memberId = req.user.id; // from JWT
    const { book_id, duration_days } = req.body;

    if (!book_id || !duration_days) {
      return res.status(400).json({
        success: false,
        message: 'Book ID and duration are required'
      });
    }

    // Check if member has overdue books
    const overdueBorrowings = await query(
      'SELECT * FROM borrowings WHERE member_id = ? AND status = "overdue"',
      [memberId]
    );

    if (overdueBorrowings.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have overdue books. Please return them first.'
      });
    }

    // Check book availability
    const books = await query('SELECT * FROM books WHERE id = ?', [book_id]);
    if (books.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    const book = books[0];
    if (book.available_copies < 1) {
      return res.status(400).json({
        success: false,
        message: 'Book not available'
      });
    }

    // Calculate due date
    const borrowDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + parseInt(duration_days));

    // Use transaction to ensure data consistency
    const result = await transaction(async (conn) => {
      // Insert borrowing
      const [borrowingResult] = await conn.execute(
        `INSERT INTO borrowings (member_id, book_id, borrow_date, due_date, status)
         VALUES (?, ?, ?, ?, 'borrowed')`,
        [memberId, book_id, borrowDate, dueDate]
      );

      // Update available copies
      await conn.execute(
        'UPDATE books SET available_copies = available_copies - 1 WHERE id = ?',
        [book_id]
      );

      return borrowingResult;
    });

    // Invalidate cache
    await deleteCachePattern('books:*');
    await deleteCachePattern(`book:${book_id}`);

    res.status(201).json({
      success: true,
      message: 'Book borrowed successfully',
      data: {
        id: result.insertId,
        member_id: memberId,
        book_id,
        borrow_date: borrowDate.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        status: 'borrowed',
        book: {
          title: book.title,
          author: book.author
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Admin create borrowing (specify member_id)
const adminCreateBorrowing = async (req, res, next) => {
  try {
    let { member_id, book_id, duration_days } = req.body;

    if (!member_id || !book_id || !duration_days) {
      return res.status(400).json({ success: false, message: 'member_id, book_id, duration_days are required' });
    }

    // Normalize inputs
    const duration = parseInt(duration_days, 10);
    if (isNaN(duration) || duration < 1) {
      return res.status(400).json({ success: false, message: 'duration_days must be a positive integer' });
    }

    // Resolve member_id: allow passing NIM (members.member_id) or numeric primary key (members.id)
    // Case-insensitive and trimmed for NIM
    let memberRow;
    const trimmedMemberId = String(member_id).trim();

    if (!isNaN(Number(trimmedMemberId))) {
      const rows = await query('SELECT * FROM members WHERE id = ?', [Number(trimmedMemberId)]);
      if (rows.length === 0) {
        const alt = await query('SELECT * FROM members WHERE TRIM(member_id) = ?', [trimmedMemberId]);
        if (alt.length === 0) {
          return res.status(404).json({ success: false, message: 'Member not found' });
        }
        memberRow = alt[0];
      } else {
        memberRow = rows[0];
      }
    } else {
      const rows = await query('SELECT * FROM members WHERE TRIM(member_id) = ?', [trimmedMemberId]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }
      memberRow = rows[0];
    }
    const resolvedMemberId = memberRow.id;

    const overdueBorrowings = await query(
      'SELECT * FROM borrowings WHERE member_id = ? AND status = "overdue"',
      [resolvedMemberId]
    );
    if (overdueBorrowings.length > 0) {
      return res.status(400).json({ success: false, message: 'Member has overdue books.' });
    }

    // Resolve book: allow passing numeric id, ISBN, or title (case-insensitive, trimmed)
    let book;
    const trimmedBookId = String(book_id).trim();

    if (!isNaN(Number(trimmedBookId))) {
      const byId = await query('SELECT * FROM books WHERE id = ?', [Number(trimmedBookId)]);
      if (byId.length > 0) {
        book = byId[0];
      }
    }
    if (!book) {
      const byIsbn = await query('SELECT * FROM books WHERE TRIM(isbn) = ?', [trimmedBookId]);
      if (byIsbn.length > 0) {
        book = byIsbn[0];
      }
    }
    if (!book) {
      const byTitle = await query('SELECT * FROM books WHERE LOWER(TRIM(title)) = LOWER(?)', [trimmedBookId]);
      if (byTitle.length > 0) {
        book = byTitle[0];
      }
    }
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found. Provide book numeric id, ISBN, or exact title.' });
    }
    if (book.available_copies < 1) {
      return res.status(400).json({ success: false, message: 'Book not available' });
    }

    const borrowDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + duration);

    const result = await transaction(async (conn) => {
      const [borrowingResult] = await conn.execute(
        `INSERT INTO borrowings (member_id, book_id, borrow_date, due_date, status)
         VALUES (?, ?, ?, ?, 'borrowed')`,
        [resolvedMemberId, book.id, borrowDate, dueDate]
      );
      await conn.execute('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?', [book.id]);
      return borrowingResult;
    });

    await deleteCachePattern('books:*');
    await deleteCachePattern(`book:${book.id}`);

    res.status(201).json({
      success: true,
      message: 'Borrowing created',
      data: {
        id: result.insertId,
        member_id: resolvedMemberId,
        book_id: book.id,
        borrow_date: borrowDate.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        status: 'borrowed'
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update borrowing (Admin) - allow updating due_date and notes
const updateBorrowing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { due_date, notes } = req.body;

    const rows = await query('SELECT * FROM borrowings WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Borrowing not found' });
    }

    await query(
      'UPDATE borrowings SET due_date = COALESCE(?, due_date), notes = COALESCE(?, notes) WHERE id = ?',
      [due_date || null, notes || null, id]
    );

    const updated = await query('SELECT * FROM borrowings WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    next(error);
  }
};

// Delete borrowing (Admin)
// If borrowing is active (borrowed/overdue), restore book available_copies
const deleteBorrowing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rows = await query('SELECT * FROM borrowings WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Borrowing not found' });
    }

    const b = rows[0];

    await transaction(async (conn) => {
      if (b.status === 'borrowed' || b.status === 'overdue') {
        await conn.execute('UPDATE books SET available_copies = available_copies + 1 WHERE id = ?', [b.book_id]);
      }
      await conn.execute('DELETE FROM borrowings WHERE id = ?', [id]);
    });

    await deleteCachePattern('books:*');
    await deleteCachePattern(`book:${b.book_id}`);
    await deleteCachePattern('stats:*');

    res.json({ success: true, message: 'Borrowing deleted' });
  } catch (error) {
    next(error);
  }
};

// Get member's own borrowings
const getMyBorrowings = async (req, res, next) => {
  try {
    const memberId = req.user.id;
    const status = req.query.status;

    let statusCondition = '';
    let params = [memberId];

    if (status) {
      statusCondition = 'AND b.status = ?';
      params.push(status);
    }

    const borrowings = await query(
      `SELECT
        b.id, b.borrow_date, b.due_date, b.return_date, b.status,
        DATEDIFF(b.due_date, CURDATE()) as days_remaining,
        bk.id as book_id, bk.title, bk.author, bk.cover_url
      FROM borrowings b
      JOIN books bk ON b.book_id = bk.id
      WHERE b.member_id = ? ${statusCondition}
      ORDER BY b.created_at DESC`,
      params
    );

    res.json({
      success: true,
      data: { borrowings }
    });
  } catch (error) {
    next(error);
  }
};

// Get all borrowings (Admin)
const getAllBorrowings = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const member_id = req.query.member_id;

    let conditions = [];
    let params = [];

    if (status) {
      conditions.push('b.status = ?');
      params.push(status);
    }

    if (member_id) {
      conditions.push('m.member_id = ?');
      params.push(member_id);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM borrowings b
      JOIN members m ON b.member_id = m.id
      ${whereClause}
    `;
    const countResult = await query(countQuery, params);
    const total = countResult[0].total;

    // Get borrowings - using template literals for LIMIT/OFFSET
    const borrowingsQuery = `
      SELECT
        b.id, b.borrow_date, b.due_date, b.return_date, b.status,
        m.id as member_id, m.member_id as member_nim, m.name as member_name, m.email as member_email,
        bk.id as book_id, bk.isbn, bk.title as book_title, bk.author as book_author
      FROM borrowings b
      JOIN members m ON b.member_id = m.id
      JOIN books bk ON b.book_id = bk.id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const borrowings = await query(borrowingsQuery, params);

    // Format response
    const formatted = borrowings.map(b => ({
      id: b.id,
      borrow_date: b.borrow_date,
      due_date: b.due_date,
      return_date: b.return_date,
      status: b.status,
      member: {
        id: b.member_id,
        member_id: b.member_nim,
        name: b.member_name,
        email: b.member_email
      },
      book: {
        id: b.book_id,
        isbn: b.isbn,
        title: b.book_title,
        author: b.book_author
      }
    }));

    res.json({
      success: true,
      data: {
        borrowings: formatted,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Process book return (Admin)
const processReturn = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    // Get borrowing details
    const borrowings = await query('SELECT * FROM borrowings WHERE id = ?', [id]);
    if (borrowings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Borrowing not found'
      });
    }

    const borrowing = borrowings[0];

    if (borrowing.status === 'returned') {
      return res.status(400).json({
        success: false,
        message: 'Book already returned'
      });
    }

    const returnDate = new Date();

    // Calculate fine if overdue (Rp 1000/day)
    let fineAmount = 0;
    if (returnDate > new Date(borrowing.due_date)) {
      const daysLate = Math.ceil((returnDate - new Date(borrowing.due_date)) / (1000 * 60 * 60 * 24));
      fineAmount = daysLate * 1000;
    }

    // Use transaction
    await transaction(async (conn) => {
      // Update borrowing
      await conn.execute(
        `UPDATE borrowings
         SET return_date = ?, status = 'returned', fine_amount = ?, notes = ?
         WHERE id = ?`,
        [returnDate, fineAmount, notes || null, id]
      );

      // Update available copies
      await conn.execute(
        'UPDATE books SET available_copies = available_copies + 1 WHERE id = ?',
        [borrowing.book_id]
      );
    });

    // Invalidate cache
    await deleteCachePattern('books:*');
    await deleteCachePattern(`book:${borrowing.book_id}`);
    await deleteCachePattern('stats:*');

    res.json({
      success: true,
      message: 'Book returned successfully',
      data: {
        id,
        return_date: returnDate.toISOString().split('T')[0],
        status: 'returned',
        fine_amount: fineAmount,
        notes
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get overdue borrowings (Admin)
const getOverdueBorrowings = async (req, res, next) => {
  try {
    const borrowings = await query(
      `SELECT
        b.id, b.borrow_date, b.due_date,
        DATEDIFF(CURDATE(), b.due_date) as days_overdue,
        DATEDIFF(CURDATE(), b.due_date) * 1000 as fine_amount,
        m.member_id, m.name as member_name, m.email as member_email,
        bk.title as book_title, bk.author as book_author
      FROM borrowings b
      JOIN members m ON b.member_id = m.id
      JOIN books bk ON b.book_id = bk.id
      WHERE b.status IN ('borrowed', 'overdue')
      AND b.due_date < CURDATE()
      ORDER BY days_overdue DESC`
    );

    // Format response
    const formatted = borrowings.map(b => ({
      id: b.id,
      borrow_date: b.borrow_date,
      due_date: b.due_date,
      days_overdue: b.days_overdue,
      fine_amount: b.fine_amount,
      member: {
        member_id: b.member_id,
        name: b.member_name,
        email: b.member_email
      },
      book: {
        title: b.book_title,
        author: b.book_author
      }
    }));

    res.json({
      success: true,
      data: {
        overdue_borrowings: formatted
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBorrowing,
  adminCreateBorrowing,
  getMyBorrowings,
  getAllBorrowings,
  processReturn,
  getOverdueBorrowings,
  updateBorrowing,
  deleteBorrowing
};
