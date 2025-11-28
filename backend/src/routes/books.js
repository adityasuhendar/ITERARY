const express = require('express');
const router = express.Router();
const {
  getBooks,
  getBookById,
  getCategories,
  createBook,
  updateBook,
  deleteBook
} = require('../controllers/bookController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Public routes
router.get('/', getBooks);  // Get all books (with search, filter, pagination)
router.get('/categories', getCategories);  // Get all categories
router.get('/:id', getBookById);  // Get book by ID

// Admin only routes
router.post('/', verifyToken, isAdmin, createBook);  // Create new book
router.put('/:id', verifyToken, isAdmin, updateBook);  // Update book
router.delete('/:id', verifyToken, isAdmin, deleteBook);  // Delete book

module.exports = router;
