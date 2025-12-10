const mysql = require('mysql2/promise');
require('dotenv').config();

// Cloud SQL connection configuration
// In Cloud Run, use Unix socket; in local dev, use TCP
const getDbConfig = () => {
  const config = {
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'iterary',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  };

  // Check if running in Cloud Run with Unix socket
  if (process.env.DB_SOCKET_PATH || process.env.INSTANCE_UNIX_SOCKET) {
    const socketPath = process.env.DB_SOCKET_PATH || process.env.INSTANCE_UNIX_SOCKET;
    console.log('🔌 Using Cloud SQL Unix socket:', socketPath);
    config.socketPath = socketPath;
  } else {
    // Local development or private IP connection
    console.log('🔌 Using TCP connection to:', process.env.DB_HOST || 'localhost');
    config.host = process.env.DB_HOST || 'localhost';
    config.port = process.env.DB_PORT || 3306;
  }

  return config;
};

// Create connection pool
const pool = mysql.createPool(getDbConfig());

// Test connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MySQL Database connection failed:', error.message);
    return false;
  }
};

// Query helper function
const query = async (sql, params) => {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Transaction helper
const transaction = async (callback) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  pool,
  query,
  transaction,
  testConnection
};
