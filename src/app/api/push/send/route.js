import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { verifyToken } from '@/lib/auth'
import webpush from 'web-push'

// Configure web-push with VAPID details and timeout
try {
  console.log('🔧 Configuring VAPID:', {
    subject: process.env.VAPID_SUBJECT ? '✅' : '❌',
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? '✅' : '❌',
    privateKey: process.env.VAPID_PRIVATE_KEY ? '✅' : '❌'
  })

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )

  // Set timeout for push requests (10 seconds)
  webpush.setGCMAPIKey(null)

  console.log('✅ VAPID configured successfully')
} catch (vapidError) {
  console.error('❌ VAPID configuration failed:', vapidError)
}

export async function POST(request) {
  try {
    // Verify authentication - only allow internal API calls
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }

    const {
      targetUserType,     // 'kasir', 'owner', or 'collector'
      targetUserId,       // specific user ID (optional)
      targetCabangId,     // specific branch (optional)
      notification
    } = await request.json()

    if (!targetUserType || !notification) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 })
    }

    // Build query to get target subscriptions
    let subscriptionQuery = `
      SELECT endpoint, p256dh_key, auth_key, id_karyawan
      FROM push_subscriptions 
      WHERE user_type = ?
    `
    let queryParams = [targetUserType]

    // Add specific user filter
    if (targetUserId) {
      subscriptionQuery += ` AND id_karyawan = ?`
      queryParams.push(targetUserId)
    }

    // Add branch filter for kasir
    if (targetCabangId && targetUserType === 'kasir') {
      subscriptionQuery += ` AND id_karyawan IN (
        SELECT id_karyawan FROM karyawan WHERE id_cabang = ?
      )`
      queryParams.push(targetCabangId)
    }

    const subscriptions = await query(subscriptionQuery, queryParams)

    console.log('🔍 Push notification query:', {
      targetUserType,
      targetUserId,
      targetCabangId,
      subscriptionsFound: subscriptions.length,
      query: subscriptionQuery,
      params: queryParams
    })

    if (subscriptions.length === 0) {
      console.log('⚠️ No subscriptions found for target users')
      return NextResponse.json({
        success: true,
        message: 'No subscriptions found for target users',
        sent: 0
      })
    }

    // Send push notifications with timeout and better error handling
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh_key,
            auth: sub.auth_key
          }
        }

        const payload = JSON.stringify({
          title: notification.title,
          body: notification.body,
          icon: notification.icon || '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          tag: notification.tag || 'dwash-notification',
          data: {
            url: notification.url || '/dashboard',
            timestamp: Date.now(),
            ...notification.data
          },
          actions: notification.actions || []
        })

        // Send with timeout wrapper (10 seconds max)
        const sendWithTimeout = Promise.race([
          webpush.sendNotification(pushSubscription, payload),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('PUSH_TIMEOUT')), 10000)
          )
        ])

        await sendWithTimeout
        return { success: true, userId: sub.id_karyawan, endpoint: sub.endpoint }
      } catch (error) {
        console.error(`❌ Failed to send push to user ${sub.id_karyawan}:`, error.message || error.code)

        // Determine if subscription should be removed
        let shouldRemove = false
        let reason = ''

        // 1. HTTP 410 Gone - subscription expired/invalid
        if (error.statusCode === 410) {
          shouldRemove = true
          reason = '410 Gone - Subscription expired'
        }
        // 2. HTTP 404 Not Found - endpoint not found
        else if (error.statusCode === 404) {
          shouldRemove = true
          reason = '404 Not Found - Invalid endpoint'
        }
        // 3. Timeout errors - connection timeout to push service
        // Remove immediately as this usually means subscription is dead
        else if (error.code === 'ETIMEDOUT' || error.message === 'PUSH_TIMEOUT') {
          shouldRemove = true
          reason = 'ETIMEDOUT - Connection timeout to push service'
        }
        // 4. Network errors - connection refused, reset
        else if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
          shouldRemove = true
          reason = `${error.code} - Network error`
        }

        // Remove subscription if needed
        if (shouldRemove) {
          try {
            await query(`
              DELETE FROM push_subscriptions
              WHERE endpoint = ?
            `, [sub.endpoint])
            console.log(`🗑️ Removed invalid subscription (${reason}):`, sub.endpoint.substring(0, 50) + '...')
          } catch (dbError) {
            console.error('Failed to remove invalid subscription:', dbError)
          }
        }

        return {
          success: false,
          userId: sub.id_karyawan,
          error: error.message || error.code,
          removed: shouldRemove
        }
      }
    })

    const results = await Promise.allSettled(sendPromises)
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
    const failed = results.length - successful

    console.log('✅ Push notification results:', {
      sent: successful,
      failed: failed,
      total: results.length,
      details: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message })
    })

    return NextResponse.json({
      success: true,
      message: `Push notifications sent`,
      sent: successful,
      failed: failed,
      total: results.length
    })

  } catch (error) {
    console.error('Push send error:', error)
    return NextResponse.json({
      error: 'Failed to send push notifications',
      message: error.message
    }, { status: 500 })
  }
}