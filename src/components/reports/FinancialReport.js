'use client'

import { useState } from 'react'
import ShiftReport from './ShiftReport'
import ExpenseManagement from '@/components/expenses/ExpenseManagement'

export default function FinancialReport({ user, onClose }) {
  const [activeTab, setActiveTab] = useState('revenue')
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }))

  const tabs = [
    { id: 'revenue', label: 'Revenue', icon: '📈', gradient: 'from-blue-500 to-blue-600' },
    { id: 'expense', label: 'Pengeluaran', icon: '💰', gradient: 'from-red-500 to-red-600' }
  ]

  return (
    <div className="space-y-6">
      {/* Tabs Navigation */}
      <div className="bg-gray-100 rounded-lg p-1 flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold rounded-md transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-white text-red-600 shadow-sm'
                : 'bg-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center justify-center gap-1 sm:gap-2">
              <span className="text-sm sm:text-base">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'revenue' && (
          <ShiftReport
            user={user}
            onClose={onClose}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        )}

        {activeTab === 'expense' && (
          <ExpenseManagement
            cabangId={user.cabang_id}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        )}
      </div>
    </div>
  )
}
