const express = require('express');
const router = express.Router();
const {
  adminLogin,
  memberLogin,
  register,
  getCurrentUser,
  logout
} = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// Public routes
router.post('/login', adminLogin);  // Admin login
router.post('/member-login', memberLogin);  // Member login
router.post('/register', register);  // Member register

// Protected routes
router.get('/me', verifyToken, getCurrentUser);  // Get current user
router.post('/logout', verifyToken, logout);  // Logout

module.exports = router;
