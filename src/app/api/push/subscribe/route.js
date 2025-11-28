import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { verifyToken } from '@/lib/auth'

export async function POST(request) {
  try {
    // Verify authentication
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }

    const { subscription } = await request.json()

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    // Check if device already has a subscription
    const existingSubscriptions = await query(`
      SELECT * FROM push_subscriptions 
      WHERE endpoint = ?
    `, [subscription.endpoint])

    if (existingSubscriptions.length > 0) {
      const existing = existingSubscriptions[0]
      
      // If exact same subscription exists
      if (existing.user_type === user.jenis_karyawan &&
          existing.id_karyawan === user.id) {
        return NextResponse.json({ 
          success: true, 
          message: 'Subscription already exists' 
        })
      }
      
      // If kasir wants to subscribe and device has kasir subscription, replace it (shift change)
      if (existing.user_type === 'kasir' && user.jenis_karyawan === 'kasir') {
        await query(`
          UPDATE push_subscriptions 
          SET id_karyawan = ?
          WHERE endpoint = ?
        `, [user.id, subscription.endpoint])
        
        return NextResponse.json({ 
          success: true, 
          message: 'Kasir subscription updated for this device' 
        })
      }
      
      // Block any other subscription attempts (owner->kasir, kasir->owner)
      return NextResponse.json({ 
        success: true, 
        message: 'Device sudah subscribe dengan akun lain' 
      })
    }

    // Insert new subscription
    await query(`
      INSERT INTO push_subscriptions (
        user_type,
        id_karyawan,
        endpoint,
        p256dh_key,
        auth_key,
        created_at
      ) VALUES (?, ?, ?, ?, ?, NOW())
    `, [
      user.jenis_karyawan,
      user.id,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth
    ])

    return NextResponse.json({ 
      success: true, 
      message: 'Push subscription saved successfully' 
    })

  } catch (error) {
    console.error('Push subscription error:', error)
    return NextResponse.json({
      error: 'Failed to save subscription',
      message: error.message
    }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    // Verify authentication
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }

    const { endpoint } = await request.json()

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint required' }, { status: 400 })
    }

    // Remove subscription
    await query(`
      DELETE FROM push_subscriptions 
      WHERE user_type = ? 
        AND id_karyawan = ? 
        AND endpoint = ?
    `, [
      user.jenis_karyawan,
      user.id,
      endpoint
    ])

    return NextResponse.json({ 
      success: true, 
      message: 'Push subscription removed successfully' 
    })

  } catch (error) {
    console.error('Push unsubscribe error:', error)
    return NextResponse.json({
      error: 'Failed to remove subscription',
      message: error.message
    }, { status: 500 })
  }
}