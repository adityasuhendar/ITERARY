// Customer push notification utilities for server-side
import webpush from 'web-push'
import { query } from '@/lib/database'

// Configure web-push (using existing VAPID keys from staff notifications)
if (process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

// Send push notification to customers for machine completion
export async function sendCustomerMachineCompletionNotification(transactionId) {
  try {
    // Get transaction details with customer info
    const transactionData = await query(`
      SELECT 
        t.id_transaksi,
        t.kode_transaksi,
        t.status_transaksi,
        t.total_keseluruhan,
        p.id_pelanggan,
        p.nama_pelanggan,
        p.nomor_telepon,
        c.id_cabang,
        c.nama_cabang,
        c.alamat,
        GROUP_CONCAT(jl.nama_layanan ORDER BY jl.nama_layanan SEPARATOR ', ') as services
      FROM transaksi t
      JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
      JOIN cabang c ON t.id_cabang = c.id_cabang
      LEFT JOIN detail_transaksi_layanan dtl ON t.id_transaksi = dtl.id_transaksi
      LEFT JOIN jenis_layanan jl ON dtl.id_jenis_layanan = jl.id_jenis_layanan
      WHERE t.id_transaksi = ? AND t.status_transaksi = 'selesai'
      GROUP BY t.id_transaksi
    `, [transactionId])

    if (transactionData.length === 0) {
      console.log('Transaction not found or not completed:', transactionId)
      return { success: false, error: 'Transaction not found or not completed' }
    }

    const transaction = transactionData[0]

    // Get customer push subscriptions
    const subscriptions = await query(`
      SELECT * FROM push_subscriptions 
      WHERE user_type = 'customer' 
        AND id_pelanggan = ? 
        AND id_cabang = ?
    `, [transaction.id_pelanggan, transaction.id_cabang])

    if (subscriptions.length === 0) {
      console.log('No customer push subscriptions found for:', transaction.nama_pelanggan)
      return { success: false, error: 'No push subscriptions found' }
    }

    // Prepare notification payload
    const notificationPayload = {
      title: '🎉 Cucian Anda Sudah Selesai!',
      body: `${transaction.services} di ${transaction.nama_cabang} telah selesai. Silakan diambil ya!`,
      icon: '/icon-192x192.png',
      badge: '/icon-96x96.png',
      tag: `customer-completion-${transaction.id_transaksi}`,
      requireInteraction: true,
      data: {
        type: 'customer_completion',
        transactionId: transaction.id_transaksi,
        transactionCode: transaction.kode_transaksi,
        branchId: transaction.id_cabang,
        branchName: transaction.nama_cabang,
        customerId: transaction.id_pelanggan,
        customerName: transaction.nama_pelanggan,
        services: transaction.services,
        total: transaction.total_keseluruhan,
        url: '/customer/status' // Future customer portal
      },
      actions: [
        {
          action: 'view',
          title: 'Lihat Detail',
          icon: '/icon-96x96.png'
        }
      ]
    }

    let successCount = 0
    let failureCount = 0
    const errors = []

    // Send to all customer subscriptions
    for (const subscription of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh_key,
            auth: subscription.auth_key
          }
        }

        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify(notificationPayload)
        )

        successCount++
        console.log(`✅ Customer completion notification sent to ${transaction.nama_pelanggan}`)

      } catch (error) {
        failureCount++
        console.error(`❌ Failed to send customer completion notification:`, error)
        errors.push({
          subscriptionId: subscription.id,
          error: error.message
        })

        // Handle invalid subscriptions (expired endpoints)
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`🗑️ Removing invalid customer subscription: ${subscription.id}`)
          await query(`
            DELETE FROM push_subscriptions WHERE id = ?
          `, [subscription.id])
        }
      }
    }

    // Log customer notification event for analytics
    try {
      await query(`
        INSERT INTO customer_notification_logs (
          id_pelanggan,
          id_cabang,
          id_transaksi,
          notification_type,
          title,
          message,
          success_count,
          failure_count,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        transaction.id_pelanggan,
        transaction.id_cabang,
        transaction.id_transaksi,
        'machine_completion',
        notificationPayload.title,
        notificationPayload.body,
        successCount,
        failureCount
      ])
    } catch (logError) {
      console.error('Failed to log customer notification:', logError)
    }

    return {
      success: successCount > 0,
      successCount,
      failureCount,
      errors,
      message: `Customer completion notification sent to ${successCount}/${successCount + failureCount} devices`
    }

  } catch (error) {
    console.error('Customer machine completion notification error:', error)
    return { success: false, error: error.message }
  }
}

// Send push notification to customers for loyalty milestones
export async function sendCustomerLoyaltyMilestoneNotification(customerId, milestone) {
  try {
    // Get customer details
    const customerData = await query(`
      SELECT 
        p.id_pelanggan,
        p.nama_pelanggan,
        p.nomor_telepon,
        p.loyalty_points,
        p.total_cuci,
        c.id_cabang,
        c.nama_cabang
      FROM pelanggan p
      LEFT JOIN cabang c ON p.last_visited_branch = c.id_cabang
      WHERE p.id_pelanggan = ?
    `, [customerId])

    if (customerData.length === 0) {
      console.log('Customer not found:', customerId)
      return { success: false, error: 'Customer not found' }
    }

    const customer = customerData[0]

    // Get customer push subscriptions (from all branches they've visited)
    const subscriptions = await query(`
      SELECT DISTINCT * FROM push_subscriptions 
      WHERE user_type = 'customer' 
        AND id_pelanggan = ?
    `, [customer.id_pelanggan])

    if (subscriptions.length === 0) {
      console.log('No customer push subscriptions found for loyalty milestone:', customer.nama_pelanggan)
      return { success: false, error: 'No push subscriptions found' }
    }

    // Prepare notification payload based on milestone
    let title, body
    if (milestone.type === 'points_earned') {
      title = '🎉 Poin Loyalty Bertambah!'
      body = `Selamat! Anda mendapat ${milestone.points} poin loyalty. Total poin: ${customer.loyalty_points}`
    } else if (milestone.type === 'free_wash_available') {
      title = '🆓 Cuci Gratis Tersedia!'
      body = `Anda bisa redeem ${customer.loyalty_points} cuci gratis! Kunjungi ${customer.nama_cabang || 'D\'Wash'} sekarang.`
    } else if (milestone.type === 'milestone_reached') {
      title = '⭐ Milestone Tercapai!'
      body = `Selamat! Anda telah mencuci ${customer.total_cuci} kali. Terus kumpulkan poin untuk hadiah lebih besar!`
    }

    const notificationPayload = {
      title,
      body,
      icon: '/icon-192x192.png',
      badge: '/icon-96x96.png',
      tag: `customer-loyalty-${customer.id_pelanggan}-${milestone.type}`,
      requireInteraction: true,
      data: {
        type: 'customer_loyalty',
        customerId: customer.id_pelanggan,
        customerName: customer.nama_pelanggan,
        milestoneType: milestone.type,
        loyaltyPoints: customer.loyalty_points,
        totalWashes: customer.total_cuci,
        branchId: customer.id_cabang,
        branchName: customer.nama_cabang,
        url: '/customer/loyalty' // Future customer loyalty portal
      },
      actions: [
        {
          action: 'view',
          title: 'Lihat Poin',
          icon: '/icon-96x96.png'
        }
      ]
    }

    let successCount = 0
    let failureCount = 0
    const errors = []

    // Send to all customer subscriptions
    for (const subscription of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh_key,
            auth: subscription.auth_key
          }
        }

        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify(notificationPayload)
        )

        successCount++
        console.log(`✅ Customer loyalty notification sent to ${customer.nama_pelanggan}`)

      } catch (error) {
        failureCount++
        console.error(`❌ Failed to send customer loyalty notification:`, error)
        errors.push({
          subscriptionId: subscription.id,
          error: error.message
        })

        // Handle invalid subscriptions
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`🗑️ Removing invalid customer subscription: ${subscription.id}`)
          await query(`
            DELETE FROM push_subscriptions WHERE id = ?
          `, [subscription.id])
        }
      }
    }

    // Log customer notification event
    try {
      await query(`
        INSERT INTO customer_notification_logs (
          id_pelanggan,
          id_cabang,
          notification_type,
          title,
          message,
          success_count,
          failure_count,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        customer.id_pelanggan,
        customer.id_cabang,
        `loyalty_${milestone.type}`,
        notificationPayload.title,
        notificationPayload.body,
        successCount,
        failureCount
      ])
    } catch (logError) {
      console.error('Failed to log customer loyalty notification:', logError)
    }

    return {
      success: successCount > 0,
      successCount,
      failureCount,
      errors,
      message: `Customer loyalty notification sent to ${successCount}/${successCount + failureCount} devices`
    }

  } catch (error) {
    console.error('Customer loyalty milestone notification error:', error)
    return { success: false, error: error.message }
  }
}

// Utility function to check if customer should receive loyalty milestone notification
export function shouldSendLoyaltyMilestone(previousTotalCuci, newTotalCuci, previousLoyaltyPoints, newLoyaltyPoints) {
  const milestones = []
  
  // Check for new points earned (every 10 washes)
  const previousEarnedPoints = Math.floor(previousTotalCuci / 10)
  const newEarnedPoints = Math.floor(newTotalCuci / 10)
  
  if (newEarnedPoints > previousEarnedPoints) {
    const pointsGained = newEarnedPoints - previousEarnedPoints
    milestones.push({
      type: 'points_earned',
      points: pointsGained
    })
  }
  
  // Check if customer now has points available for free wash
  if (previousLoyaltyPoints === 0 && newLoyaltyPoints > 0) {
    milestones.push({
      type: 'free_wash_available'
    })
  }
  
  // Check for significant milestones (25, 50, 100, etc.)
  const significantMilestones = [25, 50, 100, 200, 500]
  for (const milestone of significantMilestones) {
    if (previousTotalCuci < milestone && newTotalCuci >= milestone) {
      milestones.push({
        type: 'milestone_reached',
        milestone: milestone
      })
    }
  }
  
  return milestones
}