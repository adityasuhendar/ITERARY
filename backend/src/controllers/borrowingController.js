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
  getMyBorrowings,
  getAllBorrowings,
  processReturn,
  getOverdueBorrowings
};
