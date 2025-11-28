import { query } from '@/lib/database'
import webpush from 'web-push'

// Configure web-push with VAPID details
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

/**
 * Send push notification directly without HTTP fetch
 * Use this to avoid self-fetch ECONNREFUSED issues in shared hosting
 *
 * @param {Object} params
 * @param {string} params.targetUserType - 'kasir', 'owner', or 'collector'
 * @param {number} params.targetUserId - specific user ID (optional)
 * @param {number} params.targetCabangId - specific branch ID (optional)
 * @param {Object} params.notification - notification object with title, body, etc
 * @returns {Promise<Object>} result with success, sent, failed counts
 */
export async function sendPushNotificationDirect({
  targetUserType,
  targetUserId = null,
  targetCabangId = null,
  notification
}) {
  try {
    if (!targetUserType || !notification) {
      return {
        success: false,
        error: 'Missing required fields'
      }
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

    console.log('🔍 Push notification (direct):', {
      targetUserType,
      targetUserId,
      targetCabangId,
      subscriptionsFound: subscriptions.length
    })

    if (subscriptions.length === 0) {
      console.log('⚠️ No subscriptions found for target users')
      return {
        success: true,
        message: 'No subscriptions found for target users',
        sent: 0
      }
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

        // Log attempt (for hosting debug)
        const startTime = Date.now()
        const endpointHost = new URL(sub.endpoint).hostname
        console.log(`📤 Attempting push to user ${sub.id_karyawan} → ${endpointHost}`)

        // Send with timeout wrapper (10 seconds max)
        const sendWithTimeout = Promise.race([
          webpush.sendNotification(pushSubscription, payload),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('PUSH_TIMEOUT')), 10000)
          )
        ])

        await sendWithTimeout

        const duration = Date.now() - startTime
        console.log(`✅ Push sent to user ${sub.id_karyawan} in ${duration}ms`)

        return { success: true, userId: sub.id_karyawan, endpoint: sub.endpoint, duration }
      } catch (error) {
        // Determine if subscription should be removed
        let shouldRemove = false
        let reason = ''
        let solution = ''

        // 1. HTTP 410 Gone - subscription expired/invalid
        if (error.statusCode === 410) {
          shouldRemove = true
          reason = '410 Gone - Subscription has expired or been unsubscribed'
          solution = 'User needs to re-subscribe to notifications from their browser'
        }
        // 2. HTTP 404 Not Found - endpoint not found
        else if (error.statusCode === 404) {
          shouldRemove = true
          reason = '404 Not Found - Push service endpoint no longer exists'
          solution = 'User needs to re-subscribe to notifications from their browser'
        }
        // 3. Timeout errors - connection timeout to push service
        else if (error.code === 'ETIMEDOUT' || error.message === 'PUSH_TIMEOUT') {
          shouldRemove = true
          reason = 'ETIMEDOUT - Connection timeout to push service (10s)'
          solution = 'User device is offline, browser closed, or push service unreachable. Subscription will be auto-removed and user can re-subscribe later'
        }
        // 4. Network errors - connection refused, reset
        else if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
          shouldRemove = true
          reason = `${error.code} - Network error connecting to push service`
          solution = 'Push service is down or network blocked. Subscription will be auto-removed'
        }
        // 5. Other errors - keep subscription for retry
        else {
          shouldRemove = false
          reason = error.message || error.code || 'Unknown error'
          solution = 'Subscription kept for retry. May work on next attempt'
        }

        // Log detailed error with hosting debug info
        const duration = Date.now() - startTime
        const endpointHost = new URL(sub.endpoint).hostname
        const isProduction = process.env.NODE_ENV === 'production'

        console.error(`\n❌ PUSH NOTIFICATION FAILED`)
        console.error(`├─ User ID: ${sub.id_karyawan}`)
        console.error(`├─ Error Code: ${error.code || error.statusCode || 'N/A'}`)
        console.error(`├─ Reason: ${reason}`)
        console.error(`├─ Endpoint Host: ${endpointHost}`)
        console.error(`├─ Endpoint: ${sub.endpoint.substring(0, 60)}...`)
        console.error(`├─ Time Elapsed: ${duration}ms`)
        console.error(`├─ Environment: ${isProduction ? 'PRODUCTION (Hosting)' : 'DEVELOPMENT (Local)'}`)
        console.error(`├─ Will Remove: ${shouldRemove ? 'YES ✓' : 'NO ✗'}`)
        console.error(`└─ Solution: ${solution}`)

        // Additional hosting-specific warnings
        if (isProduction && error.code === 'ETIMEDOUT') {
          console.error(`\n⚠️  HOSTING NETWORK ISSUE DETECTED:`)
          console.error(`   This error only happens in production/hosting, not local.`)
          console.error(`   Possible causes:`)
          console.error(`   1. Hosting firewall blocking outbound connections to ${endpointHost}`)
          console.error(`   2. Hosting DNS resolver is slow/failing`)
          console.error(`   3. Hosting provider rate-limiting external requests`)
          console.error(`   4. Push service (${endpointHost}) unreachable from hosting IP`)
          console.error(`   Contact hosting support to whitelist push notification services.\n`)
        }

        // Remove subscription if needed
        if (shouldRemove) {
          try {
            await query(`
              DELETE FROM push_subscriptions
              WHERE endpoint = ?
            `, [sub.endpoint])
            console.log(`🗑️ Auto-removed invalid subscription for user ${sub.id_karyawan} (${reason})`)
          } catch (dbError) {
            console.error('❌ Failed to remove invalid subscription from database:', dbError.message)
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

    console.log('✅ Push notification results (direct):', {
      sent: successful,
      failed: failed,
      total: results.length
    })

    return {
      success: true,
      message: 'Push notifications sent',
      sent: successful,
      failed: failed,
      total: results.length
    }
  } catch (error) {
    console.error('Push notification helper error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
