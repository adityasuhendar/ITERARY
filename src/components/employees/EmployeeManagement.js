"use client"
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function EmployeeManagement({ 
  cacheConfig = { enabled: false, timeout: 0 } 
}) {
  const [activeTab, setActiveTab] = useState('accounts') // 'accounts' or 'access-codes'
  const [employees, setEmployees] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [accessCodesLoading, setAccessCodesLoading] = useState(false)
  const [error, setError] = useState('')

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterBranch, setFilterBranch] = useState('all')
  const [sortBy, setSortBy] = useState('name_asc')
  const [showModal, setShowModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Delete states
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [employeeToDelete, setEmployeeToDelete] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Staff Access Codes states
  const [accessCodes, setAccessCodes] = useState([])
  const [showAccessCodeModal, setShowAccessCodeModal] = useState(false)
  const [editingAccessCode, setEditingAccessCode] = useState(null)
  const [showDeleteAccessCodeModal, setShowDeleteAccessCodeModal] = useState(false)
  const [accessCodeToDelete, setAccessCodeToDelete] = useState(null)
  const [deleteAccessCodeLoading, setDeleteAccessCodeLoading] = useState(false)

  // Non-active employees states
  const [showNonActiveModal, setShowNonActiveModal] = useState(false)
  const [nonActiveEmployees, setNonActiveEmployees] = useState([])
  const [loadingNonActive, setLoadingNonActive] = useState(false)
  const [accessCodeForm, setAccessCodeForm] = useState({
    access_code: '',
    allowed_role: 'kasir',
    description: '',
    expires_at: ''
  })
  const [formData, setFormData] = useState({
    nama_karyawan: '',
    nomor_telepon: '',
    jenis_karyawan: 'kasir',
    shift: null,
    username: '',
    password: '',
    id_cabang: '',
    status_aktif: 'aktif'
  })

  // Global cache that persists through Fast Refresh
  if (typeof window !== 'undefined' && cacheConfig.enabled && !window.employeesCache) {
    window.employeesCache = new Map()
  }
  
  const employeesCache = cacheConfig.enabled && typeof window !== 'undefined' 
    ? { current: window.employeesCache }
    : { current: new Map() }

  // Cache management functions
  const createCacheKey = (endpoint) => `${endpoint}_employees`

  const getCachedData = (key) => {
    if (!cacheConfig.enabled) return null
    
    const cached = employeesCache.current.get(key)
    if (cached && Date.now() - cached.timestamp < cacheConfig.timeout) {
      return cached.data
    }
    return null
  }

  const setCachedData = (key, data) => {
    if (!cacheConfig.enabled) return
    
    // Limit cache size
    if (employeesCache.current.size > 20) {
      const oldestKey = employeesCache.current.keys().next().value
      employeesCache.current.delete(oldestKey)
    }
    employeesCache.current.set(key, {
      data: data,
      timestamp: Date.now()
    })
  }

  useEffect(() => {
    fetchEmployees()
    fetchBranches()
    if (activeTab === 'access-codes') {
      fetchAccessCodes()
    }
  }, [activeTab])

  const fetchEmployees = async (forceRefresh = false) => {
    try {
      setLoading(true)
      
      // Create cache key
      const cacheKey = createCacheKey('employees')
      
      // Check cache first (skip if force refresh or cache disabled)
      if (!forceRefresh && cacheConfig.enabled) {
        const cachedData = getCachedData(cacheKey)
        
        if (cachedData) {
          setEmployees(cachedData)
          setLoading(false)
          return
        }
      }
      
      const response = await fetch('/api/employees')
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Response error:', response.status, errorText)
        throw new Error(`Failed to fetch employees: ${response.status}`)
      }

      const data = await response.json()
      const employeesData = data.employees || []
      
      // Cache the data
      setCachedData(cacheKey, employeesData)
      
      setEmployees(employeesData)
    } catch (err) {
      setError(err.message)
      console.error('Fetch employees error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchBranches = async () => {
    try {
      // Create cache key for branches
      const branchCacheKey = createCacheKey('branches')
      
      // Check cache first (branches rarely change)
      if (cacheConfig.enabled) {
        const cachedBranches = getCachedData(branchCacheKey)
        
        if (cachedBranches) {
          setBranches(cachedBranches)
          return
        }
      }
      
      const response = await fetch('/api/branches')
      if (response.ok) {
        const data = await response.json()
        const branchesData = data.branches || []
        
        // Cache branches data
        setCachedData(branchCacheKey, branchesData)
        
        setBranches(branchesData)
      }
    } catch (err) {
      console.error('Fetch branches error:', err)
    }
  }


  const fetchAccessCodes = async (forceRefresh = false) => {
    try {
      setAccessCodesLoading(true)

      // Create cache key for access codes
      const accessCodeCacheKey = createCacheKey('access-codes')

      // Check cache first (skip if force refresh or cache disabled)
      if (!forceRefresh && cacheConfig.enabled) {
        const cachedData = getCachedData(accessCodeCacheKey)

        if (cachedData) {
          setAccessCodes(cachedData)
          setAccessCodesLoading(false)
          return
        }
      }

      const response = await fetch('/api/staff-access-codes')

      if (!response.ok) {
        throw new Error('Failed to fetch access codes')
      }

      const data = await response.json()
      const accessCodesData = data.accessCodes || []

      // Cache the data
      setCachedData(accessCodeCacheKey, accessCodesData)

      setAccessCodes(accessCodesData)
    } catch (err) {
      console.error('Fetch access codes error:', err)
      setErrorMessage(err.message)
      setShowErrorModal(true)
    } finally {
      setAccessCodesLoading(false)
    }
  }

  const handleAccessCodeSubmit = async (e) => {
    e.preventDefault()
    try {
      const url = editingAccessCode ? `/api/staff-access-codes/${editingAccessCode.id}` : '/api/staff-access-codes'
      const method = editingAccessCode ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(accessCodeForm),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save access code')
      }

      setShowAccessCodeModal(false)
      setEditingAccessCode(null)
      resetAccessCodeForm()
      fetchAccessCodes(true) // Force refresh after add/edit
      
      setSuccessMessage(editingAccessCode ? 'Kode akses berhasil diupdate!' : 'Kode akses berhasil ditambahkan!')
      setShowSuccessModal(true)

    } catch (err) {
      setErrorMessage(err.message)
      setShowErrorModal(true)
    }
  }

  const handleDeactivateAccessCode = async (codeId) => {
    try {
      const response = await fetch(`/api/staff-access-codes/${codeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'inactive' }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to deactivate access code')
      }

      fetchAccessCodes(true) // Force refresh after deactivate
      setSuccessMessage('Kode akses berhasil dinonaktifkan!')
      setShowSuccessModal(true)

    } catch (err) {
      setErrorMessage(err.message)
      setShowErrorModal(true)
    }
  }

  const resetAccessCodeForm = () => {
    setAccessCodeForm({
      access_code: '',
      allowed_role: 'kasir',
      description: '',
      expires_at: ''
    })
  }

  const handleOpenAccessCodeModal = () => {
    setEditingAccessCode(null)
    resetAccessCodeForm()
    setShowAccessCodeModal(true)
  }

  const handleEditAccessCode = (code) => {
    setEditingAccessCode(code)
    setAccessCodeForm({
      access_code: code.access_code,
      allowed_role: code.allowed_role,
      description: code.description || '',
      expires_at: code.expires_at ? new Date(code.expires_at).toISOString().slice(0, 16) : ''
    })
    setShowAccessCodeModal(true)
  }

  const handleDeleteAccessCodeClick = (code) => {
    setAccessCodeToDelete(code)
    setShowDeleteAccessCodeModal(true)
  }

  const handleDeleteAccessCodeConfirm = async () => {
    // Prevent multiple clicks
    if (deleteAccessCodeLoading) return

    try {
      setDeleteAccessCodeLoading(true)
      const response = await fetch(`/api/staff-access-codes/${accessCodeToDelete.id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete access code')
      }

      setShowDeleteAccessCodeModal(false)
      setAccessCodeToDelete(null)
      fetchAccessCodes(true) // Force refresh after delete

      setSuccessMessage('Kode akses berhasil dihapus!')
      setShowSuccessModal(true)

    } catch (err) {
      setErrorMessage(err.message)
      setShowErrorModal(true)
    } finally {
      setDeleteAccessCodeLoading(false)
    }
  }

  // Fetch non-active employees
  const fetchNonActiveEmployees = async () => {
    try {
      setLoadingNonActive(true)
      const response = await fetch('/api/employees?status=inactive')

      if (!response.ok) {
        throw new Error('Failed to fetch non-active employees')
      }

      const data = await response.json()
      const nonActiveData = data.employees || []

      setNonActiveEmployees(nonActiveData.filter(emp =>
        emp.jenis_karyawan !== 'super_admin' && emp.jenis_karyawan !== 'owner'
      ))
    } catch (err) {
      console.error('Fetch non-active employees error:', err)
      setErrorMessage(err.message)
      setShowErrorModal(true)
    } finally {
      setLoadingNonActive(false)
    }
  }

  // Handle non-active modal
  const handleOpenNonActiveModal = () => {
    setShowNonActiveModal(true)
    fetchNonActiveEmployees()
  }

  // Restore employee
  const handleRestoreEmployee = async (employeeId) => {
    try {
      const response = await fetch(`/api/employees/${employeeId}/restore`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status_aktif: 'aktif' }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Gagal memulihkan akun')
      }

      // Refresh both lists
      fetchEmployees(true)
      fetchNonActiveEmployees()

      setSuccessMessage('Akun berhasil dipulihkan!')
      setShowSuccessModal(true)

    } catch (err) {
      setErrorMessage(err.message)
      setShowErrorModal(true)
    }
  }




  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const url = editingEmployee ? `/api/employees/${editingEmployee.id_karyawan}` : '/api/employees'
      const method = editingEmployee ? 'PUT' : 'POST'
      
      const submitData = { ...formData }
      
      // Don't send password if editing and password is empty
      if (editingEmployee && !submitData.password) {
        delete submitData.password
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save employee')
      }

      // Success
      setShowModal(false)
      setEditingEmployee(null)
      resetForm()
      fetchEmployees(true) // Force refresh after add/edit
      
      // Show success modal
      setSuccessMessage(editingEmployee ? 'Akun berhasil diupdate!' : 'Akun berhasil ditambahkan!')
      setShowSuccessModal(true)

    } catch (err) {
      setErrorMessage(err.message)
      setShowErrorModal(true)
    }
  }

  const handleEdit = (employee) => {
    setEditingEmployee(employee)

    // Parse allowed_branches if it's a string (JSON)
    let allowedBranches = []
    if (employee.allowed_branches) {
      try {
        allowedBranches = typeof employee.allowed_branches === 'string'
          ? JSON.parse(employee.allowed_branches)
          : employee.allowed_branches
      } catch (e) {
        console.error('Error parsing allowed_branches:', e)
        allowedBranches = []
      }
    }

    setFormData({
      nama_karyawan: employee.nama_karyawan,
      nomor_telepon: employee.nomor_telepon || '',
      jenis_karyawan: employee.jenis_karyawan,
      shift: employee.jenis_karyawan === 'kasir' ? null : employee.shift, // Default to null for kasir to enable flexible shift
      username: employee.username,
      password: '', // Don't prefill password
      id_cabang: employee.id_cabang || '',
      status_aktif: employee.status_aktif,
      allowed_branches: allowedBranches
    })
    setShowModal(true)
  }

  const handleDeleteClick = (employee) => {
    setEmployeeToDelete(employee)
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = async () => {
    // Prevent multiple clicks
    if (deleteLoading) return

    try {
      setDeleteLoading(true)
      const response = await fetch(`/api/employees/${employeeToDelete.id_karyawan}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Gagal menghapus akun')
      }

      // Success
      setShowDeleteModal(false)
      setEmployeeToDelete(null)
      fetchEmployees(true) // Force refresh after delete

      setSuccessMessage('Akun berhasil dihapus!')
      setShowSuccessModal(true)

    } catch (err) {
      setErrorMessage(err.message)
      setShowErrorModal(true)
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteModal(false)
    setEmployeeToDelete(null)
  }



  const resetForm = () => {
    setFormData({
      nama_karyawan: '',
      nomor_telepon: '',
      jenis_karyawan: 'kasir',
      shift: null,
      username: '',
      password: '',
      id_cabang: branches.length > 0 ? branches[0].id_cabang : '',
      status_aktif: 'aktif',
      allowed_branches: []
    })
  }

  const handleOpenModal = () => {
    setEditingEmployee(null)
    resetForm()
    setShowModal(true)
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      aktif: 'bg-green-100 text-green-800 border-green-200',
      nonaktif: 'bg-red-100 text-red-800 border-red-200'
    }
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${statusConfig[status] || statusConfig.nonaktif}`}>
        {status}
      </span>
    )
  }

  const getRoleBadge = (role) => {
    const roleConfig = {
      super_admin: 'bg-purple-100 text-purple-800 border-purple-200',
      owner: 'bg-blue-100 text-blue-800 border-blue-200',
      collector: 'bg-green-100 text-green-800 border-green-200',
      kasir: 'bg-orange-100 text-orange-800 border-orange-200',
      investor: 'bg-indigo-100 text-indigo-800 border-indigo-200'
    }

    const config = roleConfig[role] || roleConfig.kasir

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${config}`}>
        {role}
      </span>
    )
  }

  // Helper function to get branch display for employee
  const getBranchDisplay = (employee) => {
    if (employee.jenis_karyawan === 'investor' && employee.allowed_branches) {
      try {
        const allowedBranches = typeof employee.allowed_branches === 'string'
          ? JSON.parse(employee.allowed_branches)
          : employee.allowed_branches

        if (Array.isArray(allowedBranches) && allowedBranches.length > 0) {
          // Map branch IDs to branch names
          const branchNames = allowedBranches
            .map(branchId => {
              const branch = branches.find(b => b.id_cabang === branchId)
              return branch ? branch.nama_cabang : `ID:${branchId}`
            })
            .join(', ')

          return branchNames || 'Tidak ada cabang'
        }
      } catch (e) {
        console.error('Error parsing allowed_branches:', e)
      }
      return 'Tidak ada cabang'
    }

    // For other roles, use standard logic
    return employee.nama_cabang || 'Semua Cabang'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-gray-200 rounded w-64 animate-pulse"></div>
          <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
        </div>
        <div className="bg-gray-200 animate-pulse rounded-lg h-96"></div>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <div className="text-red-600 mb-4">❌ Error loading employees: {error}</div>
          <Button onClick={fetchEmployees}>Coba Lagi</Button>
        </div>
      </Card>
    )
  }

  // Apply all filters
  const filteredEmployees = employees
    .filter(emp => emp.jenis_karyawan !== 'super_admin' && emp.jenis_karyawan !== 'owner') // Filter out admin roles
    .filter(emp => emp.status_aktif !== 'nonaktif') // Exclude non-active accounts (they have their own modal)
    .filter(emp => {
      // Search filter
      const searchMatch = searchTerm === '' ||
        emp.nama_karyawan.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.username.toLowerCase().includes(searchTerm.toLowerCase())

      // Role filter
      const roleMatch = filterRole === 'all' || emp.jenis_karyawan === filterRole

      // Status filter
      const statusMatch = filterStatus === 'all' || emp.status_aktif === filterStatus

      // Branch filter
      const branchMatch = filterBranch === 'all' ||
        (filterBranch === 'null' && !emp.id_cabang) ||
        (emp.id_cabang && emp.id_cabang.toString() === filterBranch)

      return searchMatch && roleMatch && statusMatch && branchMatch
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.nama_karyawan.localeCompare(b.nama_karyawan)
        case 'name_desc':
          return b.nama_karyawan.localeCompare(a.nama_karyawan)
        case 'role_asc':
          return a.jenis_karyawan.localeCompare(b.jenis_karyawan)
        case 'role_priority':
          const rolePriority = { 'investor': 1, 'collector': 2, 'kasir': 3, 'owner': 4, 'super_admin': 5 }
          return (rolePriority[a.jenis_karyawan] || 99) - (rolePriority[b.jenis_karyawan] || 99)
        case 'login_desc':
          return new Date(b.terakhir_login || 0) - new Date(a.terakhir_login || 0)
        default:
          return 0
      }
    })

  return (
    <div className="space-y-6">
      {/* Tabs Navigation - Material Design Style */}
      <div className="border-b border-gray-200">
        <div className="flex justify-center sm:justify-start space-x-8 px-1">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`pb-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'accounts'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            👤 Kelola Akun
            {activeTab === 'accounts' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('access-codes')}
            className={`pb-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'access-codes'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🔑 Kode Akses
            {activeTab === 'access-codes' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'accounts' ? (
        <div className="space-y-6">
          {/* Header Actions & Filters */}
          <Card>
            <div className="space-y-4">
              {/* Top Row: Search & Add Button */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="🔍 Cari nama karyawan atau username..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Button
                  onClick={() => setShowModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                >
                  + Tambah Akun
                </Button>
              </div>

              {/* Filters and Non-Active Button Row */}
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
                {/* Filter Controls - Left Side */}
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Role Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                    <select
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">Semua Role</option>
                      <option value="investor">Investor</option>
                      <option value="collector">Collector</option>
                      <option value="kasir">Kasir</option>
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">Semua Status</option>
                      <option value="aktif">Aktif</option>
                      <option value="suspend">Suspend</option>
                    </select>
                  </div>

                  {/* Branch Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Cabang</label>
                    <select
                      value={filterBranch}
                      onChange={(e) => setFilterBranch(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">Semua Cabang</option>
                      <option value="null">Semua Cabang (Owner/Collector)</option>
                      {branches.map(branch => (
                        <option key={branch.id_cabang} value={branch.id_cabang.toString()}>
                          {branch.nama_cabang}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sort Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Urutkan</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="name_asc">Nama A-Z</option>
                      <option value="name_desc">Nama Z-A</option>
                      <option value="role_asc">Role A-Z</option>
                      <option value="role_priority">Role (Investor-Collector-Kasir)</option>
                      <option value="login_desc">Login Terbaru</option>
                    </select>
                  </div>
                </div>

                {/* Kelola Non-aktif Button - Right Side */}
                <div className="w-full sm:w-auto">
                  <Button
                    onClick={handleOpenNonActiveModal}
                    className="bg-gray-600 hover:bg-gray-700 text-white whitespace-nowrap w-full sm:w-auto"
                  >
                    🔒 Kelola Non-aktif
                  </Button>
                </div>
              </div>
            </div>
          </Card>

      {/* Employee Table */}
      <Card className="overflow-hidden">
        
        {/* Mobile Cards View */}
        <div className="block sm:hidden p-4">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="animate-pulse">
                    <div className="flex justify-between items-start mb-3">
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                      <div className="h-6 bg-gray-200 rounded w-16"></div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">👤</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Tidak ada karyawan</h3>
              <p className="text-gray-600 mb-4">Belum ada karyawan yang sesuai dengan filter pencarian.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEmployees.map((employee) => (
                <div key={employee.id_karyawan} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 truncate">{employee.nama_karyawan}</h4>
                      <p className="text-sm text-gray-600">@{employee.username}</p>
                      <div className="mt-2">
                        {getRoleBadge(employee.jenis_karyawan)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 ml-3">
                      {getStatusBadge(employee.status_aktif)}
                    </div>
                  </div>

                  <div className="space-y-3 text-sm mb-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-gray-500 block text-xs uppercase tracking-wide mb-1">Cabang</span>
                        <div className="font-medium text-gray-900">{getBranchDisplay(employee)}</div>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-xs uppercase tracking-wide mb-1">Login Terakhir</span>
                        <div className="font-medium text-gray-900">{formatDate(employee.terakhir_login)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(employee)}
                      className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      ✏️ <span className="hidden sm:inline">Edit</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteClick(employee)}
                      className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      🗑️ <span className="hidden sm:inline">Hapus</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 border-r border-gray-200">
                  Informasi Akun
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 border-r border-gray-200">
                  Role & Penempatan
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 border-r border-gray-200">
                  Status & Aktivitas
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                  Tindakan
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmployees.map((employee) => (
                <tr key={employee.id_karyawan} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-5 border-r border-gray-100">
                    <div className="flex flex-col items-center space-y-1">
                      <div className="text-sm font-semibold text-gray-900">
                        {employee.nama_karyawan}
                      </div>
                      <div className="text-sm text-gray-500">
                        @{employee.username}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 border-r border-gray-100">
                    <div className="flex flex-col items-center space-y-2">
                      <div>{getRoleBadge(employee.jenis_karyawan)}</div>
                      <div className="text-sm text-gray-600 text-center">
                        <div>{getBranchDisplay(employee)}</div>
                      </div>
                      {employee.jenis_karyawan === 'kasir' && (
                        <div className="text-xs text-gray-500 text-center">
                          Shift: {employee.shift || '🔄 Fleksibel'}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5 border-r border-gray-100">
                    <div className="flex flex-col items-center space-y-2">
                      <div>{getStatusBadge(employee.status_aktif)}</div>
                      <div className="text-xs text-gray-500 text-center">
                        <div className="font-medium text-gray-600">Login Terakhir</div>
                        <div>{formatDate(employee.terakhir_login)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex justify-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(employee)}
                        className="text-blue-600 border-blue-200 hover:bg-blue-50 text-xs"
                      >
                        ✏️ Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteClick(employee)}
                        className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
                      >
                        🗑️ Hapus
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredEmployees.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500">
              <div className="text-4xl mb-4">👥</div>
              <p>Belum ada data akun</p>
            </div>
          </div>
        )}
      </Card>

      {/* Modal Form */}
      {showModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setShowModal(false)}
            ></div>

            {/* Modal panel */}
            <div className="inline-block w-full max-w-lg p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingEmployee ? 'Edit Akun' : 'Tambah Akun'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Akun *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nama_karyawan}
                  onChange={(e) => setFormData({...formData, nama_karyawan: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nomor Telepon
                </label>
                <input
                  type="tel"
                  value={formData.nomor_telepon}
                  onChange={(e) => setFormData({...formData, nomor_telepon: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="081234567890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {editingEmployee && '(kosongkan jika tidak diubah)'}
                </label>
                <input
                  type="password"
                  required={!editingEmployee}
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Minimal 6 karakter"
                />
                {formData.password && formData.password.length < 6 && (
                  <p className="text-xs text-red-500 mt-1">Password minimal 6 karakter</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jenis Akun *
                </label>
                <select
                  required
                  value={formData.jenis_karyawan}
                  onChange={(e) => {
                    const jenis = e.target.value;
                    const newFormData = { ...formData, jenis_karyawan: jenis };

                    if (jenis === 'kasir') {
                      newFormData.shift = null;
                      // If current selection is 'Semua Cabang' or no branch is selected, default to the first available branch
                      if ((newFormData.id_cabang === '' || newFormData.id_cabang === null) && branches.length > 0) {
                        newFormData.id_cabang = branches[0].id_cabang;
                      }
                    } else if (jenis === 'collector') {
                      newFormData.shift = 'keliling';
                      newFormData.id_cabang = ''; // Always set collector to 'Semua Cabang'
                    } else if (jenis === 'investor') {
                      newFormData.shift = 'full';
                      newFormData.id_cabang = ''; // Investor doesn't use id_cabang, uses allowed_branches instead
                      newFormData.allowed_branches = []; // Initialize empty allowed branches
                    } else {
                      newFormData.shift = 'full'; // owner/super_admin
                    }
                    setFormData(newFormData);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="kasir">👤 Kasir</option>
                  <option value="collector">🚗 Collector</option>
                  <option value="investor">💼 Investor</option>
                  {/* Only allow super_admin to create owner/admin */}
                </select>
              </div>

              {formData.jenis_karyawan === 'kasir' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cabang *
                </label>
                <select
                  value={formData.id_cabang}
                  onChange={(e) => setFormData({...formData, id_cabang: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  {branches.map((branch) => (
                    <option key={branch.id_cabang} value={branch.id_cabang}>
                      {branch.nama_cabang}
                    </option>
                  ))}
                </select>
              </div>
              )}

              {formData.jenis_karyawan === 'investor' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cabang yang Diizinkan *
                  </label>
                  <div className="space-y-2">
                    {branches.map((branch) => (
                      <label key={branch.id_cabang} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.allowed_branches?.includes(branch.id_cabang) || false}
                          onChange={(e) => {
                            const branchId = branch.id_cabang;
                            const currentBranches = formData.allowed_branches || [];
                            let newBranches;

                            if (e.target.checked) {
                              newBranches = [...currentBranches, branchId];
                            } else {
                              newBranches = currentBranches.filter(id => id !== branchId);
                            }

                            setFormData({...formData, allowed_branches: newBranches});
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                        />
                        <span className="text-sm text-gray-700">{branch.nama_cabang}</span>
                      </label>
                    ))}
                  </div>
                  {(!formData.allowed_branches || formData.allowed_branches.length === 0) && (
                    <p className="text-xs text-red-500 mt-1">Pilih minimal satu cabang</p>
                  )}
                </div>
              )}

              {formData.jenis_karyawan !== 'kasir' && formData.jenis_karyawan !== 'investor' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Shift
                  </label>
                  <select
                    value={formData.shift || ''}
                    onChange={(e) => setFormData({...formData, shift: e.target.value || null})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="keliling">🚗 Keliling</option>
                  </select>
                </div>
              )}

              {formData.jenis_karyawan === 'kasir' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center">
                    <span className="text-blue-500 text-lg mr-2">💡</span>
                    <div className="text-sm text-blue-700">
                      <p className="font-medium">Shift Fleksibel</p>
                      <p>Kasir akan pilih shift (pagi/malam) saat login</p>
                    </div>
                  </div>
                </div>
              )}


              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status_aktif}
                  onChange={(e) => setFormData({...formData, status_aktif: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="aktif">✅ Aktif</option>
                  <option value="nonaktif">❌ Non-aktif</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  className="flex-1"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {editingEmployee ? 'Update' : 'Simpan'}
                </Button>
              </div>
            </form>
            </div>
          </div>
        </div>,
        document.body
      )}


      {/* Success Modal */}
      {showSuccessModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="text-center">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Berhasil!
              </h3>
              <p className="text-gray-600 mb-6">
                {successMessage}
              </p>
              
              <Button
                onClick={() => setShowSuccessModal(false)}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                OK
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Error Modal */}
      {showErrorModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="text-center">
              <div className="text-6xl mb-4">❌</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Terjadi Kesalahan
              </h3>
              <p className="text-gray-600 mb-6">
                {errorMessage}
              </p>
              
              <Button
                onClick={() => setShowErrorModal(false)}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                OK
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}


      </div>
    ) : (
        // Access Codes Tab
        <div className="space-y-6">
          {/* Access Codes Table */}
          <Card className="overflow-hidden">
            <div className="p-4 sm:p-6 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Daftar Kode Akses</h3>
              <Button
                size="sm"
                onClick={handleOpenAccessCodeModal}
                className="bg-red-600 hover:bg-red-700 text-white border-red-600"
              >
                + Tambah Kode
              </Button>
            </div>

            {accessCodesLoading ? (
              // Skeleton loading for table
              <div className="p-4">
                <div className="space-y-4">
                  {[1,2,3].map((i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="h-5 bg-gray-200 rounded animate-pulse mb-2"></div>
                          <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"></div>
                        </div>
                        <div className="h-6 bg-gray-200 rounded animate-pulse w-16"></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                      </div>
                      <div className="flex space-x-2 pt-2 border-t">
                        <div className="h-8 bg-gray-200 rounded animate-pulse flex-1"></div>
                        <div className="h-8 bg-gray-200 rounded animate-pulse flex-1"></div>
                        <div className="h-8 bg-gray-200 rounded animate-pulse flex-1"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* Mobile Cards View */}
                <div className="block sm:hidden">
                  <div className="space-y-4 p-4">
                    {accessCodes.map((code) => (
                  <div key={code.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-gray-900 font-mono">{code.access_code}</h4>
                        <p className="text-sm text-gray-600">{code.description || '-'}</p>
                      </div>
                      <div className="flex space-x-2">
                        {getRoleBadge(code.allowed_role)}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <div className="font-medium">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${
                            code.status === 'active' 
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : 'bg-red-100 text-red-800 border-red-200'
                          }`}>
                            {code.status}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Digunakan:</span>
                        <div className="font-medium">{code.usage_count}x</div>
                      </div>
                    </div>
                    
                    {code.last_used_at && (
                      <div className="text-xs text-gray-500">
                        Terakhir: {formatDate(code.last_used_at)}
                      </div>
                    )}
                    
                    <div className="flex space-x-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditAccessCode(code)}
                        className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        ✏️ <span className="hidden sm:inline">Edit</span>
                      </Button>
                      {code.status === 'active' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeactivateAccessCode(code.id)}
                          className="flex-1 text-orange-600 border-orange-200 hover:bg-orange-50"
                        >
                          🚫 <span className="hidden sm:inline">Nonaktifkan</span>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteAccessCodeClick(code)}
                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                      >
                        🗑️ <span className="hidden sm:inline">Hapus</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kode Akses
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role & Deskripsi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status & Usage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {accessCodes.map((code) => (
                    <tr key={code.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-semibold font-mono text-gray-900">
                            {code.access_code}
                          </div>
                          <div className="text-sm text-gray-500">
                            Dibuat: {formatDate(code.created_at)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          {getRoleBadge(code.allowed_role)}
                          <div className="text-sm text-gray-600">
                            {code.description || 'Tidak ada deskripsi'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${
                            code.status === 'active' 
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : 'bg-red-100 text-red-800 border-red-200'
                          }`}>
                            {code.status}
                          </span>
                          <div className="text-xs text-gray-500">
                            Digunakan: {code.usage_count}x
                          </div>
                          {code.last_used_at && (
                            <div className="text-xs text-gray-500">
                              Terakhir: {formatDate(code.last_used_at)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditAccessCode(code)}
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          ✏️ Edit
                        </Button>
                        {code.status === 'active' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeactivateAccessCode(code.id)}
                            className="text-orange-600 border-orange-200 hover:bg-orange-50"
                          >
                            🚫 Nonaktifkan
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteAccessCodeClick(code)}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          🗑️ Hapus
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

                {accessCodes.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-gray-500">
                      <div className="text-4xl mb-4">🔑</div>
                      <p>Belum ada kode akses</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Access Code Modal */}
          {showAccessCodeModal && typeof document !== 'undefined' && createPortal(
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">
                    {editingAccessCode ? 'Edit Kode Akses' : 'Tambah Kode Akses'}
                  </h3>
                  <button
                    onClick={() => setShowAccessCodeModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleAccessCodeSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kode Akses *
                    </label>
                    <input
                      type="text"
                      required
                      value={accessCodeForm.access_code}
                      onChange={(e) => setAccessCodeForm({...accessCodeForm, access_code: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                      placeholder="Contoh: KASIR001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role *
                    </label>
                    <select
                      required
                      value={accessCodeForm.allowed_role}
                      onChange={(e) => setAccessCodeForm({...accessCodeForm, allowed_role: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="kasir">👤 Kasir</option>
                      <option value="collector">🚗 Collector</option>
                      <option value="investor">💼 Investor</option>
                      <option value="owner">👔 Owner</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Deskripsi
                    </label>
                    <input
                      type="text"
                      value={accessCodeForm.description}
                      onChange={(e) => setAccessCodeForm({...accessCodeForm, description: e.target.value})}
                      className={`w-full px-3 py-2 border rounded-lg ${
                        editingAccessCode
                          ? 'bg-gray-100 text-gray-600 border-gray-300 cursor-not-allowed'
                          : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                      }`}
                      placeholder="Contoh: Kode untuk kasir shift pagi"
                      disabled={editingAccessCode}
                      readOnly={editingAccessCode}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tanggal Kadaluarsa (Opsional)
                    </label>
                    <input
                      type="datetime-local"
                      value={accessCodeForm.expires_at}
                      onChange={(e) => setAccessCodeForm({...accessCodeForm, expires_at: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAccessCodeModal(false)}
                      className="flex-1"
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {editingAccessCode ? 'Update' : 'Simpan'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}

          {/* Delete Access Code Confirmation Modal */}
          {showDeleteAccessCodeModal && accessCodeToDelete && typeof document !== 'undefined' && createPortal(
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <div className="text-center">
                  <div className="text-6xl mb-4">⚠️</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Konfirmasi Hapus Kode Akses
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Yakin ingin menghapus kode akses <strong className="font-mono">{accessCodeToDelete.access_code}</strong>?
                    <br />
                    <span className="text-sm text-red-600">Aksi ini tidak dapat dibatalkan.</span>
                  </p>
                  
                  <div className="flex space-x-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDeleteAccessCodeModal(false)
                        setAccessCodeToDelete(null)
                      }}
                      className="flex-1"
                    >
                      ❌ Batal
                    </Button>
                    <Button
                      onClick={handleDeleteAccessCodeConfirm}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                      🗑️ Hapus
                    </Button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>
      )}

      {/* Delete Employee Confirmation Modal */}
      {showDeleteModal && employeeToDelete && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={handleDeleteCancel}
            ></div>

            {/* Modal panel */}
            <div className="inline-block w-full max-w-lg p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Konfirmasi Hapus Akun
                </h3>
                <button
                  onClick={handleDeleteCancel}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  ✕
                </button>
              </div>

              <div className="text-center mb-6">
                <div className="text-6xl mb-4">⚠️</div>
                <p className="text-gray-600 mb-4">
                  Yakin ingin menghapus akun <strong>{employeeToDelete.nama_karyawan}</strong>?
                </p>
                <p className="text-sm text-red-600">
                  Aksi ini tidak dapat dibatalkan.
                </p>
              </div>

              <div className="flex space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDeleteCancel}
                  disabled={deleteLoading}
                  className={`flex-1 ${
                    deleteLoading
                      ? 'text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Batal
                </Button>
                <Button
                  onClick={handleDeleteConfirm}
                  disabled={deleteLoading}
                  className={`flex-1 ${
                    deleteLoading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700'
                  } text-white`}
                >
                  {deleteLoading ? '⏳ Menghapus...' : '🗑️ Hapus'}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Non-Active Employees Modal */}
      {showNonActiveModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setShowNonActiveModal(false)}
            ></div>

            {/* Modal panel */}
            <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  🔒 Kelola Akun Non-aktif
                </h3>
                <button
                  onClick={() => setShowNonActiveModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  ✕
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Daftar akun karyawan yang telah dinonaktifkan. Anda dapat memulihkan akun dengan mengklik tombol &quot;Pulihkan&quot;.
                </p>
              </div>

              {loadingNonActive ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="animate-pulse">
                        <div className="flex justify-between items-start mb-3">
                          <div className="space-y-2 flex-1">
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                          </div>
                          <div className="h-8 bg-gray-200 rounded w-20"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : nonActiveEmployees.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">✅</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Tidak ada akun non-aktif</h3>
                  <p className="text-gray-600">Semua akun karyawan dalam status aktif.</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <div className="space-y-3">
                    {nonActiveEmployees.map((employee) => (
                      <div key={employee.id_karyawan} className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900">{employee.nama_karyawan}</h4>
                            <p className="text-sm text-gray-600">@{employee.username}</p>
                            <div className="mt-2 flex items-center space-x-3">
                              {getRoleBadge(employee.jenis_karyawan)}
                              <span className="px-2 py-1 text-xs font-medium rounded-full border bg-red-100 text-red-800 border-red-200">
                                Non-aktif
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-3 ml-4">
                            <div className="text-right">
                              <div className="text-xs text-gray-500">Cabang</div>
                              <div className="text-sm font-medium text-gray-700">
                                {getBranchDisplay(employee)}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleRestoreEmployee(employee.id_karyawan)}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              🔄 Pulihkan
                            </Button>
                          </div>
                        </div>

                        {employee.terakhir_login && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="text-xs text-gray-500">
                              Login terakhir: {formatDate(employee.terakhir_login)}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 mt-4 border-t border-gray-200">
                <Button
                  onClick={() => setShowNonActiveModal(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white"
                >
                  Tutup
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}