const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getPopularBooks
} = require('../controllers/statsController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Admin only routes
router.get('/dashboard', verifyToken, isAdmin, getDashboardStats);  // Dashboard stats
router.get('/popular-books', getPopularBooks);  // Popular books (public)

module.exports = router;
