const jwt = require('jsonwebtoken');
require('dotenv').config();

// Verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  console.log('🔐 Auth Header:', authHeader ? 'Present' : 'Missing');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('❌ Auth failed: No Bearer token');
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      error: { code: 'UNAUTHORIZED' }
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token verified for user:', decoded.username || decoded.email);
    req.user = decoded;
    next();
  } catch (error) {
    console.log('❌ Token verification failed:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      error: { code: 'UNAUTHORIZED' }
    });
  }
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
      error: { code: 'FORBIDDEN' }
    });
  }
  next();
};

// Check if user is member
const isMember = (req, res, next) => {
  if (!req.user || !req.user.member_id) {
    return res.status(403).json({
      success: false,
      message: 'Member access required',
      error: { code: 'FORBIDDEN' }
    });
  }
  next();
};

module.exports = {
  verifyToken,
  isAdmin,
  isMember
};
