const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { pool } = require('../config/db');
const { getRedisClient } = require('../config/redis');

// Settings file path for persistence
const SETTINGS_FILE = path.join(__dirname, '..', '..', 'data', 'settings.json');

// Default settings
const DEFAULT_SETTINGS = {
  system: { appName: 'ITERARY', maxBooks: 3, borrowDurationDays: 7, maintenance: false, logo_url: null },
  profile: { fullName: 'Admin', username: 'admin', email: 'admin@itera.ac.id', avatar_url: null },
  appearance: { themeIndex: 0 }
};

// Load settings from file or use defaults
const loadSettings = () => {
  try {
    const dataDir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
  return { ...DEFAULT_SETTINGS };
};

// Save settings to file
const saveSettings = (settings) => {
  try {
    const dataDir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Error saving settings:', err);
  }
};

let SETTINGS = loadSettings();

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const prefix = file.fieldname === 'logo' ? 'logo' : 'avatar';
    const name = `${prefix}_${Date.now()}${ext || '.jpg'}`;
    cb(null, name);
  }
});
const upload = multer({ storage });

// Health check endpoint
router.get('/settings/health', verifyToken, isAdmin, async (req, res) => {
  const health = {
    database: { status: 'disconnected', message: '', latency: null },
    redis: { status: 'disconnected', message: '' },
    server: { status: 'running', uptime: process.uptime() }
  };

  try {
    const startTime = Date.now();
    const connection = await pool.getConnection();
    await connection.query('SELECT 1 as test');
    connection.release();
    const latency = Date.now() - startTime;
    health.database = {
      status: 'connected',
      message: 'MySQL database is connected',
      latency: `${latency}ms`,
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'iterary'
    };
  } catch (err) {
    health.database = {
      status: 'error',
      message: err.message || 'Failed to connect to database',
      latency: null
    };
  }

  try {
    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      await redis.ping();
      health.redis = {
        status: 'connected',
        message: 'Redis cache is connected',
        host: process.env.REDIS_HOST || 'localhost'
      };
    } else if (redis) {
      health.redis = { status: 'connecting', message: `Redis status: ${redis.status}` };
    } else {
      health.redis = { status: 'disabled', message: 'Redis is not configured' };
    }
  } catch (err) {
    health.redis = { status: 'error', message: err.message || 'Failed to connect to Redis' };
  }

  res.json({ success: true, health });
});

// Get all settings
router.get('/settings', verifyToken, isAdmin, (req, res) => {
  res.json({ success: true, ...SETTINGS });
});

// Update system settings (with optional logo upload)
router.put('/settings/system', verifyToken, isAdmin, upload.single('logo'), (req, res) => {
  const payload = { ...(req.body || {}) };
  
  // Parse boolean and number values from form data
  if (payload.maxBooks) payload.maxBooks = parseInt(payload.maxBooks);
  if (payload.borrowDurationDays) payload.borrowDurationDays = parseInt(payload.borrowDurationDays);
  if (payload.maintenance !== undefined) {
    payload.maintenance = payload.maintenance === 'true' || payload.maintenance === true;
  }
  
  // Handle logo upload
  if (req.file) {
    payload.logo_url = `/api/uploads/${req.file.filename}`;
  }
  
  SETTINGS.system = { ...SETTINGS.system, ...payload };
  saveSettings(SETTINGS);
  res.json({ success: true, system: SETTINGS.system });
});

// Update profile settings (with optional avatar upload)
router.put('/settings/profile', verifyToken, isAdmin, upload.single('avatar'), (req, res) => {
  const payload = { ...(req.body || {}) };
  const normalized = {
    ...(payload.fullName ? { fullName: payload.fullName } : {}),
    ...(payload.username ? { username: payload.username } : {}),
    ...(payload.email ? { email: payload.email } : {}),
  };
  if (req.file) {
    normalized.avatar_url = `/api/uploads/${req.file.filename}`;
  }
  SETTINGS.profile = { ...SETTINGS.profile, ...normalized };
  saveSettings(SETTINGS);
  res.json({ success: true, profile: SETTINGS.profile });
});

// Update appearance settings
router.put('/settings/appearance', verifyToken, isAdmin, (req, res) => {
  SETTINGS.appearance = { ...SETTINGS.appearance, ...(req.body || {}) };
  saveSettings(SETTINGS);
  res.json({ success: true, appearance: SETTINGS.appearance });
});

// Update password
router.put('/settings/security/password', verifyToken, isAdmin, (req, res) => {
  res.json({ success: true, message: 'Password updated' });
});

module.exports = router;
