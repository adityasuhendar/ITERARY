const { query } = require('../config/db');
const { getCache, setCache, deleteCachePattern } = require('../config/redis');

// Get all books with pagination, search, filter
const getBooks = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const sort = req.query.sort || 'title';

    // Build cache key
    const cacheKey = `books:page:${page}:limit:${limit}:search:${search}:category:${category}:sort:${sort}`;

    // Check cache
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true
      });
    }

    // Build WHERE clause
    let whereConditions = [];
    let queryParams = [];

    if (search) {
      whereConditions.push('(title LIKE ? OR author LIKE ? OR isbn LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    if (category) {
      whereConditions.push('category = ?');
      queryParams.push(category);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Validate sort field
    const validSortFields = ['title', 'author', 'year_published', 'created_at'];
    const sortField = validSortFields.includes(sort) ? sort : 'title';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM books ${whereClause}`;
    const countResult = await query(countQuery, queryParams);
    const total = countResult[0].total;

    // Get books - using template literals for LIMIT/OFFSET instead of prepared statement params
    const booksQuery = `
      SELECT
        id, isbn, title, author, publisher, year_published, category,
        total_copies, available_copies, cover_url, description,
        CASE
          WHEN available_copies > 0 THEN 'Available'
          ELSE 'Not Available'
        END as availability_status,
        created_at, updated_at
      FROM books
      ${whereClause}
      ORDER BY ${sortField} ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const books = await query(booksQuery, queryParams);

    const result = {
      books,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    };

    // Cache result for 5 minutes
    await setCache(cacheKey, result, 300);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Get book by ID
const getBookById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check cache
    const cacheKey = `book:${id}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true
      });
    }

    const books = await query('SELECT * FROM books WHERE id = ?', [id]);

    if (books.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    // Cache for 10 minutes
    await setCache(cacheKey, books[0], 600);

    res.json({
      success: true,
      data: books[0]
    });
  } catch (error) {
    next(error);
  }
};

// Get all categories
const getCategories = async (req, res, next) => {
  try {
    // Check cache
    const cacheKey = 'books:categories';
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: { categories: cached },
        cached: true
      });
    }

    const result = await query('SELECT DISTINCT category FROM books ORDER BY category');
    const categories = result.map(row => row.category);

    // Cache for 1 hour
    await setCache(cacheKey, categories, 3600);

    res.json({
      success: true,
      data: { categories }
    });
  } catch (error) {
    next(error);
  }
};

// Create new book (Admin only)
const createBook = async (req, res, next) => {
  try {
    const {
      isbn, title, author, publisher, year_published,
      category, total_copies, available_copies, cover_url, description
    } = req.body;

    // Validate required fields
    if (!isbn || !title || !author) {
      return res.status(400).json({
        success: false,
        message: 'ISBN, title, and author are required'
      });
    }

    // Insert book
    const result = await query(
      `INSERT INTO books
       (isbn, title, author, publisher, year_published, category,
        total_copies, available_copies, cover_url, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        isbn, title, author, publisher || null, year_published || null,
        category || 'General', total_copies || 1, available_copies || 1,
        cover_url || null, description || null
      ]
    );

    // Invalidate cache
    await deleteCachePattern('books:*');

    res.status(201).json({
      success: true,
      message: 'Book created successfully',
      data: {
        id: result.insertId,
        isbn, title, author, publisher, year_published,
        category, total_copies, available_copies
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update book (Admin only)
const updateBook = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      isbn, title, author, publisher, year_published,
      category, total_copies, available_copies, cover_url, description
    } = req.body;

    // Check if book exists
    const existing = await query('SELECT * FROM books WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (isbn !== undefined) { updates.push('isbn = ?'); values.push(isbn); }
    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (author !== undefined) { updates.push('author = ?'); values.push(author); }
    if (publisher !== undefined) { updates.push('publisher = ?'); values.push(publisher); }
    if (year_published !== undefined) { updates.push('year_published = ?'); values.push(year_published); }
    if (category !== undefined) { updates.push('category = ?'); values.push(category); }
    if (total_copies !== undefined) { updates.push('total_copies = ?'); values.push(total_copies); }
    if (available_copies !== undefined) { updates.push('available_copies = ?'); values.push(available_copies); }
    if (cover_url !== undefined) { updates.push('cover_url = ?'); values.push(cover_url); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    // Add id to values
    values.push(id);

    await query(
      `UPDATE books SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Invalidate cache
    await deleteCachePattern('books:*');
    await deleteCachePattern(`book:${id}`);

    res.json({
      success: true,
      message: 'Book updated successfully',
      data: { id, ...req.body }
    });
  } catch (error) {
    next(error);
  }
};

// Delete book (Admin only)
const deleteBook = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if book exists
    const books = await query('SELECT * FROM books WHERE id = ?', [id]);
    if (books.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    // Check if book has active borrowings
    const activeBorrowings = await query(
      'SELECT * FROM borrowings WHERE book_id = ? AND status IN ("borrowed", "overdue")',
      [id]
    );

    if (activeBorrowings.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete book with active borrowings'
      });
    }

    // Delete book
    await query('DELETE FROM books WHERE id = ?', [id]);

    // Invalidate cache
    await deleteCachePattern('books:*');
    await deleteCachePattern(`book:${id}`);

    res.json({
      success: true,
      message: 'Book deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBooks,
  getBookById,
  getCategories,
  createBook,
  updateBook,
  deleteBook
};
