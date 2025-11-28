// 'use client'

// import { useState } from 'react'
// import Modal from '@/components/ui/Modal'
// import Button from '@/components/ui/Button'
// import { pushManager } from '@/lib/pushNotifications'

// export default function NotificationPermissionModal({ 
//   isOpen, 
//   onClose, 
//   user = null,
//   onSuccess,
//   onSkip 
// }) {
//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState('')

//   const handleEnableNotifications = async () => {
//     try {
//       setLoading(true)
//       setError('')
      
//       const context = {
//         reason: user?.jenis_karyawan === 'owner' 
//           ? 'Dapatkan notifikasi saat ada request baru dari kasir yang perlu disetujui'
//           : 'Dapatkan notifikasi saat ada request baru dari kasir yang perlu disetujui'
//       }
      
//       const result = await pushManager.enableNotifications(context)
      
//       if (result.success) {
//         console.log('✅ Push notifications enabled for', user?.jenis_karyawan)
//         onSuccess && onSuccess()
//         onClose()
//       } else {
//         setError(result.error || 'Gagal mengaktifkan notifikasi')
//       }
//     } catch (error) {
//       console.error('Failed to enable notifications:', error)
//       setError('Terjadi kesalahan saat mengaktifkan notifikasi')
//     } finally {
//       setLoading(false)
//     }
//   }

//   const handleSkip = () => {
//     console.log('ℹ️ Push notifications skipped by user', user?.jenis_karyawan)
//     onSkip && onSkip()
//     onClose()
//   }

//   return (
//     <Modal 
//       isOpen={isOpen} 
//       onClose={handleSkip}
//       title="Aktifkan Notifikasi"
//       size="md"
//     >
//       <div className="space-y-6">
//         {/* Header Icon */}
//         <div className="text-center">
//           <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100">
//             <span className="text-3xl">🔔</span>
//           </div>
//         </div>

//         {/* Content */}
//         <div className="text-center space-y-4">
//           <h3 className="text-lg font-semibold text-gray-900">
//             Aktifkan Push Notifications?
//           </h3>
          
//           <div className="text-sm text-gray-600 space-y-3">
//             <p>
//               Dapatkan notifikasi real-time untuk:
//             </p>
            
//             <div className="bg-blue-50 rounded-lg p-4 text-left">
//               {user?.jenis_karyawan === 'owner' ? (
//                 <div className="space-y-2">
//                   <div className="flex items-start space-x-3">
//                     <span className="text-green-500 mt-0.5">✓</span>
//                     <span>Request stock dari kasir yang butuh persetujuan</span>
//                   </div>
//                   <div className="flex items-start space-x-3">
//                     <span className="text-green-500 mt-0.5">✓</span>
//                     <span>Alert sistem dan maintenance mesin</span>
//                   </div>
//                   <div className="flex items-start space-x-3">
//                     <span className="text-green-500 mt-0.5">✓</span>
//                     <span>Laporan harian dan mingguan</span>
//                   </div>
//                 </div>
//               ) : (
//                 <div className="space-y-2">
//                   <div className="flex items-start space-x-3">
//                     <span className="text-green-500 mt-0.5">✓</span>
//                     <span>Status approval dari owner</span>
//                   </div>
//                   <div className="flex items-start space-x-3">
//                     <span className="text-green-500 mt-0.5">✓</span>
//                     <span>Alert mesin dan sistem</span>
//                   </div>
//                   <div className="flex items-start space-x-3">
//                     <span className="text-green-500 mt-0.5">✓</span>
//                     <span>Reminder shift dan tugas</span>
//                   </div>
//                 </div>
//               )}
//             </div>

//             <div className="bg-gray-50 rounded-lg p-3">
//               <p className="text-xs text-gray-500">
//                 💡 <strong>Tips:</strong> Anda bisa mengatur notifikasi kapan saja di pengaturan browser
//               </p>
//             </div>
//           </div>

//           {error && (
//             <div className="bg-red-50 border border-red-200 rounded-lg p-3">
//               <p className="text-sm text-red-600">
//                 ⚠️ {error}
//               </p>
//             </div>
//           )}
//         </div>

//         {/* Action Buttons */}
//         <div className="flex flex-col sm:flex-row sm:justify-center space-y-3 sm:space-y-0 sm:space-x-3">
//           <Button
//             variant="outline"
//             onClick={handleSkip}
//             disabled={loading}
//             className="w-full sm:w-auto"
//           >
//             ⏭️ Lewati
//           </Button>
//           <Button
//             onClick={handleEnableNotifications}
//             disabled={loading}
//             className="w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-700"
//           >
//             {loading ? (
//               <div className="flex items-center justify-center">
//                 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
//                 Mengaktifkan...
//               </div>
//             ) : (
//               <>🔔 Aktifkan Notifikasi</>
//             )}
//           </Button>
//         </div>

//         {/* Footer Note */}
//         <div className="text-xs text-gray-400 text-center border-t pt-4">
//           <p>
//             Notifikasi akan muncul di browser dan device Anda. 
//             Pastikan browser mendukung push notifications.
//           </p>
//         </div>
//       </div>
//     </Modal>
//   )
// }