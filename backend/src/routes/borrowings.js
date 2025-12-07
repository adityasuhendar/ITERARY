const express = require('express');
const router = express.Router();
const {
  createBorrowing,
  adminCreateBorrowing,
  getMyBorrowings,
  getAllBorrowings,
  processReturn,
  getOverdueBorrowings
} = require('../controllers/borrowingController');
const { verifyToken, isAdmin, isMember } = require('../middleware/auth');
const { updateBorrowing, deleteBorrowing } = require('../controllers/borrowingController');

// Member routes
router.post('/', verifyToken, isMember, createBorrowing);  // Borrow book
router.get('/me', verifyToken, isMember, getMyBorrowings);  // Get my borrowings

// Admin routes
router.post('/admin', verifyToken, isAdmin, adminCreateBorrowing); // Admin create borrowing
router.get('/overdue', verifyToken, isAdmin, getOverdueBorrowings);  // Get overdue borrowings
router.get('/', verifyToken, isAdmin, getAllBorrowings);  // Get all borrowings
router.put('/:id/return', verifyToken, isAdmin, processReturn);  // Process return
router.put('/:id', verifyToken, isAdmin, updateBorrowing);  // Update borrowing (due_date, notes)
router.delete('/:id', verifyToken, isAdmin, deleteBorrowing);  // Delete borrowing record

module.exports = router;
