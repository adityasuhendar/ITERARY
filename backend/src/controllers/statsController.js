const { query } = require('../config/db');
const { getCache, setCache } = require('../config/redis');

// Dashboard statistics
const getDashboardStats = async (req, res, next) => {
  try {
    // Check cache
    const cacheKey = 'stats:dashboard';
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true
      });
    }

    // Get total books
    const [totalBooksResult] = await query('SELECT COUNT(*) as total FROM books');
    const total_books = totalBooksResult.total;

    // Get total available
    const [availableResult] = await query('SELECT SUM(available_copies) as total FROM books');
    const total_available = availableResult.total || 0;

    // Get total borrowed
    const [borrowedResult] = await query('SELECT SUM(total_copies - available_copies) as total FROM books');
    const total_borrowed = borrowedResult.total || 0;

    // Get total members
    const [membersResult] = await query('SELECT COUNT(*) as total FROM members WHERE status = "active"');
    const total_members = membersResult.total;

    // Get active borrowings
    const [activeBorrowingsResult] = await query(
      'SELECT COUNT(*) as total FROM borrowings WHERE status IN ("borrowed", "overdue")'
    );
    const active_borrowings = activeBorrowingsResult.total;

    // Get overdue borrowings
    const [overdueResult] = await query(
      'SELECT COUNT(*) as total FROM borrowings WHERE status = "overdue" OR (status = "borrowed" AND due_date < CURDATE())'
    );
    const overdue_borrowings = overdueResult.total;

    // Get recent borrowings (last 5)
    const recentBorrowings = await query(
      `SELECT
        b.id, b.borrow_date,
        m.name as member_name,
        bk.title as book_title,
        b.due_date, b.status
      FROM borrowings b
      JOIN members m ON b.member_id = m.id
      JOIN books bk ON b.book_id = bk.id
      ORDER BY b.created_at DESC
      LIMIT 5`
    );

    // Get popular books (most borrowed)
    const popularBooks = await query(
      `SELECT
        bk.id, bk.title, bk.author,
        COUNT(b.id) as borrow_count
      FROM books bk
      LEFT JOIN borrowings b ON bk.id = b.book_id
      GROUP BY bk.id, bk.title, bk.author
      ORDER BY borrow_count DESC
      LIMIT 5`
    );

    const stats = {
      total_books,
      total_available,
      total_borrowed,
      total_members,
      active_borrowings,
      overdue_borrowings,
      recent_borrowings: recentBorrowings,
      popular_books: popularBooks
    };

    // Cache for 1 minute
    await setCache(cacheKey, stats, 60);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

// Popular books
const getPopularBooks = async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit) || 10));

    // Check cache
    const cacheKey = `stats:popular-books:${limit}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: { popular_books: cached },
        cached: true
      });
    }

    const popularBooks = await query(
      `SELECT
        bk.id, bk.title, bk.author, bk.category, bk.cover_url,
        COUNT(b.id) as borrow_count
      FROM books bk
      LEFT JOIN borrowings b ON bk.id = b.book_id
      GROUP BY bk.id, bk.title, bk.author, bk.category, bk.cover_url
      ORDER BY borrow_count DESC
      LIMIT ${limit}`
    );

    // Cache for 10 minutes
    await setCache(cacheKey, popularBooks, 600);

    res.json({
      success: true,
      data: {
        popular_books: popularBooks
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getPopularBooks
};
