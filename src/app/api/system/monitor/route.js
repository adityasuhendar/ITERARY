import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { internalPool, customerPool } from '@/lib/database'

export async function GET(request) {
  try {
    // Get token from cookies
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')

    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      )
    }

    // Verify JWT token
    let decoded
    try {
      decoded = jwt.verify(token.value, process.env.JWT_SECRET)
    } catch (jwtError) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Check if user is owner (only owner can access system monitoring)
    if (decoded.jenis_karyawan !== 'owner') {
      return NextResponse.json(
        { error: 'Access denied. Owner role required.' },
        { status: 403 }
      )
    }

    // Get detailed pool status - improved detection
    const getPoolDetails = (pool, poolName, expectedConfig) => {
      try {
        // Try multiple property paths for different MySQL2 versions
        const totalConnections =
          pool._allConnections?.length ||
          pool.pool?._allConnections?.length ||
          pool._connectionQueue?.pool?._allConnections?.length || 0

        const activeConnections =
          pool._acquiringConnections?.length ||
          pool.pool?._acquiringConnections?.length ||
          pool._acquiringConnectionsCount || 0

        const idleConnections =
          pool._freeConnections?.length ||
          pool.pool?._freeConnections?.length ||
          pool._freeConnectionsCount || 0

        const queuedRequests =
          pool._connectionQueue?.length ||
          pool.pool?._connectionQueue?.length ||
          pool._queuedConnectionCallbacks?.length || 0

        // Use expected config as fallback
        const config = {
          connection_limit:
            pool.config?.connectionLimit ||
            pool._config?.connectionLimit ||
            expectedConfig.connectionLimit,
          queue_limit:
            pool.config?.queueLimit ||
            pool._config?.queueLimit ||
            expectedConfig.queueLimit,
          idle_timeout:
            pool.config?.idleTimeout ||
            pool._config?.idleTimeout ||
            expectedConfig.idleTimeout,
          max_idle:
            pool.config?.maxIdle ||
            pool._config?.maxIdle ||
            expectedConfig.maxIdle
        }

        return {
          name: poolName,
          total_connections: totalConnections,
          active_connections: activeConnections,
          idle_connections: idleConnections,
          queued_requests: queuedRequests,
          config: config,
          debug_info: {
            pool_type: pool.constructor?.name || 'Unknown',
            has_config: !!pool.config,
            has_private_config: !!pool._config,
            available_properties: Object.keys(pool).filter(key => !key.startsWith('_')).slice(0, 10)
          }
        }
      } catch (error) {
        return {
          name: poolName,
          error: error.message,
          total_connections: 0,
          active_connections: 0,
          idle_connections: 0,
          queued_requests: 0,
          config: expectedConfig || {},
          debug_info: {
            error_details: error.message
          }
        }
      }
    }

    // Expected configurations for fallback
    const internalConfig = {
      connectionLimit: 200,
      queueLimit: 300,
      idleTimeout: 300000,
      maxIdle: 100
    }

    const customerConfig = {
      connectionLimit: 5,
      queueLimit: 50,
      idleTimeout: 300000,
      maxIdle: 3
    }

    // Get internal pool details
    const internalPoolStatus = getPoolDetails(internalPool, 'Internal Pool', internalConfig)

    // Get customer pool details
    const customerPoolStatus = getPoolDetails(customerPool, 'Customer Pool', customerConfig)

    // Calculate health scores
    const calculateHealthScore = (poolStatus) => {
      const { active_connections, queued_requests, config } = poolStatus
      const connectionUtilization = (active_connections / config.connection_limit) * 100
      const queueUtilization = (queued_requests / config.queue_limit) * 100

      let score = 100

      // Penalize high connection utilization
      if (connectionUtilization > 90) score -= 30
      else if (connectionUtilization > 70) score -= 15
      else if (connectionUtilization > 50) score -= 5

      // Penalize queue buildup
      if (queueUtilization > 50) score -= 40
      else if (queueUtilization > 30) score -= 20
      else if (queueUtilization > 10) score -= 10

      return Math.max(0, Math.round(score))
    }

    // Get system information
    const systemInfo = {
      timestamp: new Date().toISOString(),
      server_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      nodejs_version: process.version,
      memory_usage: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024), // MB
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024) // MB
      },
      uptime_seconds: Math.round(process.uptime())
    }

    // Calculate overall health
    const internalHealth = calculateHealthScore(internalPoolStatus)
    const customerHealth = calculateHealthScore(customerPoolStatus)
    const overallHealth = Math.round((internalHealth + customerHealth) / 2)

    // Determine status
    const getStatus = (score) => {
      if (score >= 80) return 'healthy'
      if (score >= 60) return 'warning'
      if (score >= 40) return 'critical'
      return 'emergency'
    }

    // Create alerts if needed
    const alerts = []

    if (internalPoolStatus.queued_requests > 50) {
      alerts.push({
        level: 'warning',
        message: `High queue in internal pool: ${internalPoolStatus.queued_requests} requests`,
        recommendation: 'Monitor for potential deadlock'
      })
    }

    if (customerPoolStatus.queued_requests > 20) {
      alerts.push({
        level: 'warning',
        message: `High queue in customer pool: ${customerPoolStatus.queued_requests} requests`,
        recommendation: 'Check customer API performance'
      })
    }

    if (internalPoolStatus.active_connections / internalPoolStatus.config.connection_limit > 0.9) {
      alerts.push({
        level: 'critical',
        message: 'Internal pool near capacity',
        recommendation: 'Consider increasing pool size or restarting application'
      })
    }

    // Response data
    const monitoringData = {
      status: getStatus(overallHealth),
      health_score: overallHealth,
      last_updated: systemInfo.timestamp,

      pools: {
        internal: {
          ...internalPoolStatus,
          health_score: internalHealth,
          utilization_percentage: Math.round((internalPoolStatus.active_connections / internalPoolStatus.config.connection_limit) * 100),
          queue_percentage: Math.round((internalPoolStatus.queued_requests / internalPoolStatus.config.queue_limit) * 100)
        },
        customer: {
          ...customerPoolStatus,
          health_score: customerHealth,
          utilization_percentage: Math.round((customerPoolStatus.active_connections / customerPoolStatus.config.connection_limit) * 100),
          queue_percentage: Math.round((customerPoolStatus.queued_requests / customerPoolStatus.config.queue_limit) * 100)
        }
      },

      system: systemInfo,
      alerts: alerts,

      recommendations: alerts.length === 0 ? [
        'System performance is optimal',
        'Database pools are operating within normal parameters'
      ] : alerts.map(alert => alert.recommendation)
    }

    return NextResponse.json(monitoringData)

  } catch (error) {
    console.error('System monitor API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message,
        status: 'error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Health check endpoint (lighter version)
export async function HEAD(request) {
  try {
    // Simple health check - just return status
    const internalActive = internalPool._acquiringConnections?.length || 0
    const internalLimit = internalPool.config?.connectionLimit || 200

    if (internalActive / internalLimit > 0.95) {
      return new NextResponse(null, { status: 503 }) // Service Unavailable
    }

    return new NextResponse(null, { status: 200 }) // OK
  } catch (error) {
    return new NextResponse(null, { status: 500 }) // Internal Server Error
  }
}