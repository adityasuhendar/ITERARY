import mysql from 'mysql2/promise'

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: '+07:00', // Force WIB timezone
  dateStrings: false, // Return as strings to avoid timezone conversion issues
  connectTimeout: 20000 // 20 detik untuk connect ke database (default 10s)
}

// CONNECTION POOL CONFIGURATION - Jagoan Hosting (Max 75 connections)
// =======================================================================
const INTERNAL_CONNECTIONS = 60   // ← KASIR: Dashboard, transactions, reports, staff operations
const CUSTOMER_CONNECTIONS = 10   // ← CUSTOMER: Homepage loyalty, machine status
// Total = 70 connections (sisakan 5 buffer untuk manual queries/cron)
const INTERNAL_QUEUE = 200        // ← Queue for traffic spikes
const CUSTOMER_QUEUE = 50         // ← Customer APIs are cached and lightweight

// Create separate connection pools for customer vs internal operations
const internalPool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: INTERNAL_CONNECTIONS,
  queueLimit: INTERNAL_QUEUE,
  idleTimeout: 300000, // 5 minutes idle timeout
  maxIdle: 30, // Keep 30 warm connections
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
})

const customerPool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: CUSTOMER_CONNECTIONS,
  queueLimit: CUSTOMER_QUEUE,
  idleTimeout: 300000, // 5 minutes idle timeout
  maxIdle: 5, // Keep 5 warm connections
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
})

// Legacy pool for backward compatibility (use internal pool)
const pool = internalPool

// Add pool error listeners only (remove verbose logging)
internalPool.on('error', (err) => {
  console.error('❌ Internal pool error:', err)
})

customerPool.on('error', (err) => {
  console.error('❌ Customer pool error:', err)
})

// Only log when high queue detected (on-demand monitoring)
function checkPoolStatus() {
  const internalStatus = {
    total: internalPool._allConnections?.length || 0,
    active: internalPool._acquiringConnections?.length || 0,
    free: internalPool._freeConnections?.length || 0,
    queued: internalPool._connectionQueue?.length || 0
  }
  const customerStatus = {
    total: customerPool._allConnections?.length || 0,
    active: customerPool._acquiringConnections?.length || 0,
    free: customerPool._freeConnections?.length || 0,
    queued: customerPool._connectionQueue?.length || 0
  }
  
  if (internalStatus.queued > 10 || customerStatus.queued > 15) {
    console.warn('🚨 High queue detected:', { internal: internalStatus, customer: customerStatus })
  }
}

// Customer API endpoints that should use customer pool
const CUSTOMER_API_ENDPOINTS = [
  '/api/loyalty',
  '/api/customers/validate', 
  '/api/machines/count',
  '/api/machines/status/public',
  '/api/push/send-customer',
  '/api/push/subscribe-customer',
  '/api/chat'
];


// Helper function to determine if request is from customer API (legacy - for reference)
function isCustomerAPI(requestUrl = '') {
  return CUSTOMER_API_ENDPOINTS.some(endpoint => 
    requestUrl.includes(endpoint)
  )
}

export async function query(sql, params = [], poolType = 'internal') {
  // Use parameter to determine pool (fixes race condition)
  const poolToUse = poolType === 'customer' ? customerPool : internalPool
  
  let retries = 3
  let lastError = null
  
  while (retries > 0) {
    try {
      const [results] = await poolToUse.query(sql, params)
      return results
    } catch (error) {
      lastError = error
      console.error('Database query error:', error)
      
      // If connection limit exceeded, wait longer and retry
      if (error.code === 'ER_CON_COUNT_ERROR' && retries > 1) {
        console.warn(`Database connection limit reached, retrying... (${retries-1} attempts left)`)
        // Exponential backoff: wait longer on each retry
        const waitTime = (4 - retries) * 2000 // 2s, 4s, 6s
        await new Promise(resolve => setTimeout(resolve, waitTime))
        retries--
        continue
      }
      
      // If timeout or other recoverable error, retry
      if ((error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') && retries > 1) {
        console.warn(`Database connection error (${error.code}), retrying... (${retries-1} attempts left)`)
        await new Promise(resolve => setTimeout(resolve, 1000))
        retries--
        continue
      }
      
      // If pool is exhausted but not connection limit error, retry once
      if (error.message?.includes('Pool is closed') && retries > 1) {
        console.warn(`Connection pool closed, retrying... (${retries-1} attempts left)`)
        await new Promise(resolve => setTimeout(resolve, 1500))
        retries--
        continue
      }
      
      break // Non-retryable error, exit loop
    }
  }
  
  // If we get here, all retries failed
  throw lastError || new Error('Database query failed after all retries')
}

// Get connection from pool for transactions
export async function getConnection(poolType = 'internal') {
  // Use parameter to determine pool for transactions
  const poolToUse = poolType === 'customer' ? customerPool : internalPool
  let retries = 3
  let lastError = null
  
  while (retries > 0) {
    try {
      const connection = await poolToUse.getConnection()
      return connection
    } catch (error) {
      lastError = error
      console.error('Database getConnection error:', error)
      
      if (error.code === 'ER_CON_COUNT_ERROR' && retries > 1) {
        console.warn(`Too many connections, retrying getConnection... (${retries-1} attempts left)`)
        const waitTime = (4 - retries) * 2000
        await new Promise(resolve => setTimeout(resolve, waitTime))
        retries--
        continue
      }
      
      break
    }
  }
  
  throw lastError || new Error('Failed to get database connection after all retries')
}

// Function to get pool status
export function getPoolStatus() {
  return {
    totalConnections: pool._allConnections?.length || 0,
    activeConnections: pool._acquiringConnections?.length || 0,
    freeConnections: pool._freeConnections?.length || 0,
    queuedRequests: pool._connectionQueue?.length || 0
  }
}

// Function to close pool gracefully
export async function closePool() {
  try {
    await pool.end()
    console.log('Database pool closed successfully')
  } catch (error) {
    console.error('Error closing database pool:', error)
  }
}

// Helper function to execute transaction
export async function executeTransaction(callback, poolType = 'internal') {
  let connection = null
  
  try {
    connection = await getConnection(poolType)
    await connection.beginTransaction()
    const result = await callback(connection)
    await connection.commit()
    return result
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback()
      } catch (rollbackError) {
        console.error('Transaction rollback error:', rollbackError)
      }
    }
    console.error('Transaction error:', error)
    throw error
  } finally {
    if (connection) {
      try {
        connection.release()
      } catch (releaseError) {
        console.error('Connection release error:', releaseError)
      }
    }
  }
}

// Export pools for monitoring
export { internalPool, customerPool }
export default pool