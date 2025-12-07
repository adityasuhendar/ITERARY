const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Simple in-memory settings store as fallback; replace with DB if available
// Frontend expects camelCase keys: system { appName, maxBooks, borrowDurationDays, maintenance }
// profile { fullName, username, email, avatar_url }
let SETTINGS = {
  system: { appName: 'ITERARY', maxBooks: 3, borrowDurationDays: 7, maintenance: false, logo_url: null },
  profile: { fullName: 'Admin', username: 'admin', email: 'admin@itera.ac.id', avatar_url: null },
  appearance: { themeIndex: 0 }
};

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const name = `avatar_${Date.now()}${ext || ''}`;
    cb(null, name);
  }
});
const upload = multer({ storage });

// Get all settings
router.get('/settings', verifyToken, isAdmin, (req, res) => {
  res.json({ success: true, ...SETTINGS });
});

// Update system settings (JSON only; logo upload out-of-scope for now)
router.put('/settings/system', verifyToken, isAdmin, (req, res) => {
  const payload = req.body || {};
  SETTINGS.system = { ...SETTINGS.system, ...payload };
  res.json({ success: true, system: SETTINGS.system });
});

// Update profile settings (with optional avatar upload)
router.put('/settings/profile', verifyToken, isAdmin, upload.single('avatar'), (req, res) => {
  const payload = { ...(req.body || {}) };
  // Normalize payload keys from form fields
  const normalized = {
    ...(payload.fullName ? { fullName: payload.fullName } : {}),
    ...(payload.username ? { username: payload.username } : {}),
    ...(payload.email ? { email: payload.email } : {}),
  };
  if (req.file) {
    // Serve via /api/uploads/<filename>
    normalized.avatar_url = `/api/uploads/${req.file.filename}`;
  }
  SETTINGS.profile = { ...SETTINGS.profile, ...normalized };
  res.json({ success: true, profile: SETTINGS.profile });
});

// Update appearance settings
router.put('/settings/appearance', verifyToken, isAdmin, (req, res) => {
  SETTINGS.appearance = { ...SETTINGS.appearance, ...(req.body || {}) };
  res.json({ success: true, appearance: SETTINGS.appearance });
});

// Update password (stub)
router.put('/settings/security/password', verifyToken, isAdmin, (req, res) => {
  // Accept and ignore for now; integrate with auth later
  res.json({ success: true, message: 'Password updated' });
});

module.exports = router;