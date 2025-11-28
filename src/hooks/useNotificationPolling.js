// TOAST NOTIFICATION SYSTEM DISABLED
// "use client"
// import { useEffect, useRef, useState } from 'react'
// import { useToastContext } from '@/context/ToastContext'

// export function useNotificationPolling(user) {
//   const { showToast } = useToastContext()
//   const lastCheckRef = useRef(null)
//   const shownNotificationsRef = useRef(new Set()) // Track shown toast notifications
//   const [isPolling, setIsPolling] = useState(false)

//   useEffect(() => {
//     // Only poll for kasir role
//     if (!user || (user.role !== 'kasir' && user.jenis_karyawan !== 'kasir')) {
//       return
//     }

//     // Set initial last check time (start from login time, not show existing notifications)
//     if (!lastCheckRef.current) {
//       lastCheckRef.current = new Date() // Start fresh dari sekarang
//     }

//     const pollForNewNotifications = async () => {
//       if (isPolling) return // Prevent multiple concurrent polls
      
//       try {
//         setIsPolling(true)
        
//         // Check for new notifications since last check
//         const response = await fetch('/api/notifications/new', {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify({ 
//             since: lastCheckRef.current.toISOString() 
//           })
//         })

//         if (response.ok) {
//           const data = await response.json()
          
//           // Show toast for each NEW notification (not already shown)
//           data.new_notifications?.forEach(notification => {
//             // Skip if already shown as toast
//             if (shownNotificationsRef.current.has(notification.id)) {
//               return
//             }
            
//             // Mark as shown
//             shownNotificationsRef.current.add(notification.id)
            
//             const isApproved = notification.message.includes('disetujui')
//             const isRejected = notification.message.includes('ditolak')
            
//             showToast[isApproved ? 'success' : isRejected ? 'rejected' : 'info'](
//               isApproved ? '✅ Request Disetujui!' : 
//               isRejected ? '❌ Request Ditolak!' : 
//               '📋 Update Request',
//               notification.message,
//               {
//                 subtitle: notification.approved_by ? `oleh ${notification.approved_by}` : undefined,
//                 duration: 5000, // 5 seconds for important notifications
//                 onClick: () => {
//                   // Focus pada bell icon untuk buka notifications
//                   const bellIcon = document.querySelector('[title="Notifikasi"]')
//                   if (bellIcon) {
//                     bellIcon.click()
//                   }
//                 }
//               }
//             )
//           })

//           // Update last check time
//           lastCheckRef.current = new Date()
//         }
//       } catch (error) {
//         console.error('Notification polling error:', error)
//       } finally {
//         setIsPolling(false)
//       }
//     }

//     // Poll every 5 minutes to reduce server load
//     const interval = setInterval(pollForNewNotifications, 300000)

//     // Cleanup
//     return () => {
//       clearInterval(interval)
//       // Clear shown notifications tracking on unmount
//       shownNotificationsRef.current.clear()
//     }
//   }, [user?.id, user?.role, user?.jenis_karyawan, showToast])

//   return { isPolling }
// }