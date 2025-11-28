'use client'

import Logo from '@/components/ui/Logo'
import LoginForm from '@/components/forms/LoginForm'
import { BRAND } from '@/lib/constants'

export default function LoginPage() {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-dwash-red via-red-600 to-red-800 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-xl"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-dwash-yellow rounded-full blur-lg"></div>
        <div className="absolute bottom-20 left-1/4 w-40 h-40 bg-white rounded-full blur-2xl"></div>
        <div className="absolute bottom-40 right-10 w-20 h-20 bg-dwash-yellow rounded-full blur-md"></div>
      </div>
      
      <div className="relative z-10 h-full flex items-center justify-center p-2 overflow-hidden">
        <div className="w-full max-w-[90%] sm:max-w-sm lg:max-w-md mx-auto max-h-[95vh] overflow-y-auto">
          <div className="bg-white/95 backdrop-blur-sm shadow-2xl rounded-2xl p-4 sm:p-6 lg:p-8 border-0">
            {/* Header dengan branding DWash - Kompakt Mobile */}
            <div className="text-center mb-3 sm:mb-6 lg:mb-8">
            <div className="mb-2 sm:mb-4 flex justify-center">
                <Logo variant="full" size="xl" className="max-w-20 sm:max-w-32 lg:max-w-36 h-auto rounded-lg" />
              </div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">
                DWash Laundry
              </h1>
              <p className="text-gray-600 text-xs sm:text-sm lg:text-base font-medium">
                Staff Login Portal
              </p>
            </div>
            
            {/* Login Form */}
            <LoginForm />
          </div>
          
          {/* Footer - Enhanced Mobile */}
          <div className="text-center text-red-100 text-xs sm:text-sm opacity-80 hover:opacity-100 transition-opacity mt-2 sm:mt-4 px-2">
            <p>© 2025 DWash Laundry</p>
            <p className="text-xs opacity-70">All rights reserved</p>
          </div>
        </div>
      </div>
    </div>
  )
}