import { getPoolStatus } from '../../../lib/database.js';

export async function GET() {
  try {
    const poolStatus = getPoolStatus();
    
    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      internal_pool: {
        total_connections: poolStatus.totalConnections,
        active_connections: poolStatus.activeConnections,
        free_connections: poolStatus.freeConnections,
        queued_requests: poolStatus.queuedRequests,
        utilization: poolStatus.totalConnections > 0 
          ? Math.round((poolStatus.activeConnections / poolStatus.totalConnections) * 100) + '%'
          : '0%'
      },
      memory_usage: process.memoryUsage(),
      uptime: process.uptime()
    });
    
  } catch (error) {
    console.error('Pool status error:', error);
    
    return Response.json({
      success: false,
      error: 'Failed to get pool status',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}