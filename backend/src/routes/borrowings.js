const express = require('express');
const router = express.Router();
const {
  createBorrowing,
  getMyBorrowings,
  getAllBorrowings,
  processReturn,
  getOverdueBorrowings
} = require('../controllers/borrowingController');
const { verifyToken, isAdmin, isMember } = require('../middleware/auth');

// Member routes
router.post('/', verifyToken, isMember, createBorrowing);  // Borrow book
router.get('/me', verifyToken, isMember, getMyBorrowings);  // Get my borrowings

// Admin routes
router.get('/overdue', verifyToken, isAdmin, getOverdueBorrowings);  // Get overdue borrowings
router.get('/', verifyToken, isAdmin, getAllBorrowings);  // Get all borrowings
router.put('/:id/return', verifyToken, isAdmin, processReturn);  // Process return

module.exports = router;
