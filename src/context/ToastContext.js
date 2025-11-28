// "use client"
// import { createContext, useContext } from 'react'
// import { useToast } from '@/components/notifications/ToastNotification'

// const ToastContext = createContext()

// export function ToastProvider({ children }) {
//   const toastManager = useToast()

//   return (
//     <ToastContext.Provider value={toastManager}>
//       {children}
//       <toastManager.ToastContainer />
//     </ToastContext.Provider>
//   )
// }

// export function useToastContext() {
//   const context = useContext(ToastContext)
//   if (!context) {
//     throw new Error('useToastContext must be used within ToastProvider')
//   }
//   return context
// }