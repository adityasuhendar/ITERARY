const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
require('dotenv').config();

// Generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Admin Login
const adminLogin = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Find admin by username or email
    const admins = await query(
      'SELECT * FROM admins WHERE username = ? OR email = ?',
      [username, username]
    );

    if (admins.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const admin = admins[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken({
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role || 'admin'
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: admin.id,
          username: admin.username,
          name: admin.name,
          email: admin.email,
          role: admin.role || 'admin'
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/// Member Login (FINAL FIX: Menerima 'username' dan memprosesnya sebagai 'email')
const memberLogin = async (req, res, next) => {
  try {
    const { email, username, password } = req.body;

    // Gunakan salah satu
    const userEmail = email || username;

    // FIX VALIDASI
    if (!userEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Query berdasarkan email
    const members = await query(
      'SELECT * FROM members WHERE email = ?',
      [userEmail]
    );

    if (members.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const member = members[0];

    if (member.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is suspended or inactive'
      });
    }

    const isValidPassword = await bcrypt.compare(password, member.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = generateToken({
      id: member.id,
      member_id: member.member_id,
      email: member.email,
      role: 'member'
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: member.id,
          member_id: member.member_id,
          name: member.name,
          email: member.email,
          member_type: member.member_type
        }
      }
    });
  } catch (error) {
    next(error);
  }
};


// Member Register (FINAL FIX: Auto-generate member_id & Fix field name)
const register = async (req, res, next) => {
  try {
    // 1. TANGKAP full_name (kunci dari form FE) dan HAPUS member_id dari destructuring
    const { full_name, email, phone, password, member_type } = req.body;

    // 2. GENERATE member_id otomatis (MEM-Timestamp)
    const member_id = "MEM-" + Date.now();

    // 3. UBAH VALIDASI: Cek full_name saja
    if (!full_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full Name, email, and password are required' // Ubah pesan error
      });
    }

    // Check if email already exists
    const existing = await query(
      // Hapus pengecekan member_id di SQL
      'SELECT * FROM members WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. UBAH INSERT: Gunakan full_name untuk mengisi kolom 'name' di Database
    const result = await query(
      `INSERT INTO members (member_id, name, email, phone, password_hash, member_type, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [member_id, full_name, email, phone || null, hashedPassword, member_type || 'student']
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        id: result.insertId,
        member_id,
        name: full_name, // Kirim nama yang benar di response
        email
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get current user
const getCurrentUser = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let user;

    if (role === 'admin') {
      const admins = await query('SELECT * FROM admins WHERE id = ?', [userId]);
      if (admins.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      user = {
        id: admins[0].id,
        username: admins[0].username,
        name: admins[0].name,
        email: admins[0].email,
        role: admins[0].role
      };
    } else {
      const members = await query('SELECT * FROM members WHERE id = ?', [userId]);
      if (members.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      user = {
        id: members[0].id,
        member_id: members[0].member_id,
        name: members[0].name,
        email: members[0].email,
        member_type: members[0].member_type,
        status: members[0].status
      };
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// Logout (client-side token removal, server just confirms)
const logout = async (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
};

module.exports = {
  adminLogin,
  memberLogin,
  register,
  getCurrentUser,
  logout
};
