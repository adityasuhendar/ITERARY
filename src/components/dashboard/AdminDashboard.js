'use client'

import { useState, useEffect } from 'react'
import StatsCard from './StatsCard'
import Card from '@/components/ui/Card'

export default function AdminDashboard({ user }) {
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchDashboardData()
    // Auto refresh every 120 seconds (reduced from 30 seconds)
    const interval = setInterval(fetchDashboardData, 120000)
    return () => clearInterval(interval)
  }, [])

  const fetchDashboardData = async () => {
    try {
      if (typeof window === 'undefined') {
        setError('Not in browser environment')
        return
      }

      const response = await fetch('/api/dashboard/admin')

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('user')
          window.location.href = '/'
          throw new Error('Session expired. Please login again.')
        }
        if (response.status === 403) {
          throw new Error('Access denied. Super admin role required.')
        }
        throw new Error(`Server error: ${response.status}`)
      }

      const data = await response.json()
      setDashboardData(data)
      setError(null)
    } catch (err) {
      setError(err.message)
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0)
  }

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRoleColor = (role) => {
    const colors = {
      'super_admin': 'bg-purple-100 text-purple-800',
      'owner': 'bg-blue-100 text-blue-800',
      'collector': 'bg-green-100 text-green-800',
      'kasir': 'bg-orange-100 text-orange-800'
    }
    return colors[role] || 'bg-gray-100 text-gray-800'
  }

  const getRoleName = (role) => {
    const names = {
      'super_admin': 'Super Admin',
      'owner': 'Owner',
      'collector': 'Collector',
      'kasir': 'Kasir'
    }
    return names[role] || role
  }

  const getHealthStatus = (total, broken) => {
    const percentage = total > 0 ? ((total - broken) / total * 100) : 100
    if (percentage >= 95) return { text: 'Excellent', color: 'text-green-600', percentage }
    if (percentage >= 85) return { text: 'Good', color: 'text-blue-600', percentage }
    if (percentage >= 70) return { text: 'Fair', color: 'text-yellow-600', percentage }
    return { text: 'Poor', color: 'text-red-600', percentage }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-200 animate-pulse rounded-lg h-32"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-200 animate-pulse rounded-lg h-64"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="mb-4">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div className="text-red-600 text-lg font-medium mb-2">Oops! Ada masalah</div>
          <div className="text-gray-600 mb-4">{error}</div>
        </div>
        {!error.includes('login') && !error.includes('Access denied') && (
          <button 
            onClick={fetchDashboardData}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Coba Lagi
          </button>
        )}
      </div>
    )
  }

  if (!dashboardData) return null

  const { 
    system_overview, 
    user_stats, 
    branch_stats, 
    financial_overview, 
    recent_activity, 
    system_health, 
    audit_logs, 
    performance_metrics 
  } = dashboardData

  const machineHealth = getHealthStatus(system_health.machines.total_machines, system_health.machines.broken)

  return (
    <div className="space-y-6">
      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard
          title="Total Pengguna"
          value={system_overview.total_users}
          subtitle={`${user_stats.role_distribution.reduce((sum, role) => sum + role.active_count, 0)} aktif`}
          icon="👥"
          color="purple"
        />
        <StatsCard
          title="Cabang Aktif"
          value={system_overview.active_branches}
          subtitle={`${branch_stats.filter(b => b.today_transactions > 0).length} operasional hari ini`}
          icon="🏪"
          color="blue"
        />
        <StatsCard
          title="Kesehatan Sistem"
          value={`${machineHealth.percentage.toFixed(1)}%`}
          subtitle={`${machineHealth.text} - ${system_health.machines.broken} rusak`}
          icon="💚"
          color="green"
        />
        <StatsCard
          title="Alert Sistem"
          value={system_overview.low_stock_alerts + system_overview.broken_machines}
          subtitle={`${system_overview.low_stock_alerts} stok, ${system_overview.broken_machines} mesin`}
          icon="⚠️"
          color={system_overview.low_stock_alerts + system_overview.broken_machines > 0 ? "red" : "green"}
        />
      </div>

      {/* Financial Overview */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Ringkasan Finansial</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(financial_overview.daily.total_revenue)}
            </div>
            <div className="text-sm text-gray-600">Pendapatan Hari Ini</div>
            <div className="text-xs text-green-600 mt-1">
              {financial_overview.daily.total_transactions} transaksi
            </div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(financial_overview.monthly.total_revenue)}
            </div>
            <div className="text-sm text-gray-600">Pendapatan Bulan Ini</div>
            <div className="text-xs text-blue-600 mt-1">
              {financial_overview.monthly.total_transactions} transaksi
            </div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(financial_overview.yearly.total_revenue)}
            </div>
            <div className="text-sm text-gray-600">Pendapatan Tahun Ini</div>
            <div className="text-xs text-purple-600 mt-1">
              {financial_overview.yearly.total_transactions} transaksi
            </div>
          </div>
        </div>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold mb-4">Performa Harian</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span>Transaksi Hari Ini</span>
              <div className="text-right">
                <span className="font-medium">{performance_metrics.today.transactions}</span>
                <div className={`text-sm ${performance_metrics.transaction_growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {performance_metrics.transaction_growth >= 0 ? '+' : ''}{performance_metrics.transaction_growth}% vs kemarin
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span>Rata-rata Nilai Transaksi</span>
              <span className="font-medium">{formatCurrency(performance_metrics.today.avg_transaction_value)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
              <span>Pertumbuhan Revenue</span>
              <div className={`font-medium ${performance_metrics.revenue_growth >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
                {performance_metrics.revenue_growth >= 0 ? '+' : ''}{performance_metrics.revenue_growth}%
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Status User</h3>
          <div className="space-y-3">
            {user_stats.role_distribution.map((role) => (
              <div key={role.role} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleColor(role.role)}`}>
                    {getRoleName(role.role)}
                  </span>
                  <span>{role.count} total</span>
                </div>
                <div className="text-right">
                  <div className="text-green-600 font-medium">{role.active_count} aktif</div>
                  <div className="text-sm text-gray-600">{role.recent_login_count} login 24h</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Branch Performance */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Performa Cabang Hari Ini</h3>
        <div className="space-y-3">
          {branch_stats.map((branch) => (
            <div key={branch.id_cabang} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-4">
                <div className={`w-3 h-3 rounded-full ${
                  branch.status_aktif === 'aktif' ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <div>
                  <h4 className="font-medium">{branch.nama_cabang}</h4>
                  <p className="text-sm text-gray-600">
                    {branch.staff_count} karyawan • {branch.total_machines} mesin 
                    {branch.broken_machines > 0 && ` • ${branch.broken_machines} rusak`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium text-green-600">{formatCurrency(branch.today_revenue)}</div>
                <div className="text-sm text-gray-600">{branch.today_transactions} transaksi</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* System Health Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold mb-4">Status Mesin</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span>Tersedia</span>
              <span className="text-green-600 font-medium">{system_health.machines.available}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span>Digunakan</span>
              <span className="text-blue-600 font-medium">{system_health.machines.in_use}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
              <span>Maintenance</span>
              <span className="text-yellow-600 font-medium">{system_health.machines.maintenance}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
              <span>Rusak</span>
              <span className="text-red-600 font-medium">{system_health.machines.broken}</span>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Alert Inventori</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
              <span>Stok Habis</span>
              <span className="text-red-600 font-medium">{system_health.inventory.out_of_stock || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
              <span>Stok Rendah</span>
              <span className="text-orange-600 font-medium">{system_health.inventory.low_stock || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span>Total Alert</span>
              <span className="text-gray-600 font-medium">{system_health.inventory.total_alerts || 0}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold mb-4">Aktivitas Transaksi Terakhir</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {recent_activity.recent_transactions.map((transaction, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-sm">{transaction.kode_transaksi}</h4>
                  <p className="text-xs text-gray-600">
                    {transaction.nama_pelanggan} • {transaction.nama_cabang} • {transaction.nama_karyawan}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-medium text-green-600 text-sm">{formatCurrency(transaction.total_keseluruhan)}</div>
                  <div className="text-xs text-gray-600">{transaction.metode_pembayaran ? transaction.metode_pembayaran.toUpperCase() : 'BELUM DIBAYAR'}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Audit Log Terakhir</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {audit_logs.slice(0, 10).map((log) => (
              <div key={log.id_audit} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-sm">{log.tabel_diubah}</h4>
                  <p className="text-xs text-gray-600">
                    {log.aksi} oleh {log.nama_karyawan || 'System'} ({log.jenis_karyawan})
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-600">{formatDateTime(log.waktu_aksi)}</div>
                  <div className="text-xs text-gray-500">{log.ip_address}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Logins */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Login Terakhir</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {user_stats.recent_logins.map((login, index) => (
            <div key={index} className="p-3 bg-gray-50 rounded-lg">
              <h4 className="font-medium">{login.nama_karyawan}</h4>
              <p className="text-sm text-gray-600">
                {getRoleName(login.jenis_karyawan)} • {login.nama_cabang || 'Central'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {formatDateTime(login.terakhir_login)}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}