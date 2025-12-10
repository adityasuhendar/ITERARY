const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import config
const { testConnection } = require('./config/db');
const { initRedis } = require('./config/redis');

// Import routes
const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const borrowingRoutes = require('./routes/borrowings');
const statsRoutes = require('./routes/stats');
const categoryRoutes = require('./routes/categories');
const memberRoutes = require('./routes/members');
const settingsRoutes = require('./routes/settings');

// Import middleware
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
const allowedOrigins = [
  'https://iterary.web.id',
  'https://iterary-frontend-889794700120.asia-southeast2.run.app',
  'http://localhost:3000',
  'https://iterary-proxy.xpvggvg12.workers.dev'
];
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger (development)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'ITERARY Backend API is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/borrowings', borrowingRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/members', memberRoutes);
// Settings routes
app.use('/api', settingsRoutes);
// Static uploads (for avatars, logos, etc.)
app.use('/api/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to ITERARY API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      books: '/api/books',
      borrowings: '/api/borrowings',
      stats: '/api/stats'
    }
  });
});

// 404 handler
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Start Express server first (important for Cloud Run health checks)
    app.listen(PORT, () => {
      console.log('');
      console.log('='.repeat(50));
      console.log('🚀 ITERARY Backend Server Started!');
      console.log('='.repeat(50));
      console.log(`📡 Server: http://localhost:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('='.repeat(50));
      console.log('');
    });

    // Test database connection with retry logic (non-blocking)
    let dbConnected = false;
    let retries = 5;
    while (!dbConnected && retries > 0) {
      dbConnected = await testConnection();
      if (!dbConnected) {
        console.log(`⚠️  Database not ready. Retrying in 2 seconds... (${retries} attempts left)`);
        retries--;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (dbConnected) {
      console.log('📚 Database: MySQL (connected)');
    } else {
      console.warn('⚠️  Database: MySQL (connection failed, will retry on first request)');
    }

    // Initialize Redis (optional, can be disabled via REDIS_ENABLED=false)
    initRedis();
    const redisEnabled = process.env.REDIS_ENABLED === 'false' ? 'disabled' : (process.env.REDIS_HOST ? 'enabled' : 'disabled');
    console.log(`⚡ Cache: Redis (${redisEnabled})`);
    console.log('='.repeat(50));
    console.log('');
  } catch (error) {
    console.error('Error during startup:', error);
    // Don't exit, server might still work
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;
