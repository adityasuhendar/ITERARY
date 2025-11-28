import { NextResponse } from 'next/server'
import { internalPool, customerPool } from '@/lib/database'

export async function GET(request) {
  try {
    // Debug pool object structure
    const debugPool = (pool, name) => {
      return {
        name,
        constructor_name: pool.constructor?.name,
        own_properties: Object.getOwnPropertyNames(pool),
        enumerable_properties: Object.keys(pool),
        has_config: !!pool.config,
        has_private_config: !!pool._config,
        config_object: pool.config,
        private_config_object: pool._config,
        sample_properties: {
          _allConnections: pool._allConnections?.length || 'undefined',
          _acquiringConnections: pool._acquiringConnections?.length || 'undefined',
          _freeConnections: pool._freeConnections?.length || 'undefined',
          _connectionQueue: pool._connectionQueue?.length || 'undefined'
        }
      }
    }

    const debugInfo = {
      timestamp: new Date().toISOString(),
      internal_pool: debugPool(internalPool, 'Internal Pool'),
      customer_pool: debugPool(customerPool, 'Customer Pool'),
      mysql2_version: require('mysql2/package.json').version
    }

    return NextResponse.json(debugInfo, { status: 200 })

  } catch (error) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}