import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { verifyToken } from '@/lib/auth'
import { checkCSRF } from '@/lib/csrf'
import { validatePhoneNumber } from '@/lib/security'

export async function GET(request) {
  try {
    // Get auth token to determine user branch
    const token = request.cookies.get('auth-token')?.value
    let userBranchId = null

    if (token) {
      try {
        const user = verifyToken(token)
        // Kasir can only see customers from their branch
        if (user && user.jenis_karyawan === 'kasir' && user.cabang_id) {
          userBranchId = user.cabang_id
        }
        // Owner can see all customers (userBranchId remains null)
      } catch (err) {
        // Invalid token, continue without auth
      }
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page')) || 1
    const limit = parseInt(searchParams.get('limit')) || 10
    const search = searchParams.get('search') || ''
    const loyaltyFilter = searchParams.get('loyaltyFilter') || 'all'
    const phoneFilter = searchParams.get('phoneFilter') || 'all'
    const sortBy = searchParams.get('sortBy') || 'name_asc'
    const branchFilter = searchParams.get('branch_filter') || null

    const offset = (page - 1) * limit

    // Build WHERE conditions
    let whereConditions = ["p.status_aktif = 'aktif'"]
    let searchQueryParams = []

    // Branch filter for kasir (forced by role)
    if (userBranchId) {
      whereConditions.push("p.id_cabang = ?")
      searchQueryParams.push(userBranchId)
    }
    // Branch filter for owner (optional filter)
    else if (branchFilter && branchFilter !== 'all') {
      whereConditions.push("p.id_cabang = ?")
      searchQueryParams.push(parseInt(branchFilter))
    }

    // Search condition
    if (search && search.trim()) {
      whereConditions.push("(p.nama_pelanggan LIKE ? OR p.nomor_telepon LIKE ?)")
      searchQueryParams.push(`%${search}%`, `%${search}%`)
    }

    // Loyalty points filter
    if (loyaltyFilter === 'with_points') {
      whereConditions.push("p.loyalty_points > 0")
    } else if (loyaltyFilter === 'no_points') {
      whereConditions.push("(p.loyalty_points = 0 OR p.loyalty_points IS NULL)")
    }

    // Phone status filter
    if (phoneFilter === 'with_phone') {
      whereConditions.push("p.nomor_telepon IS NOT NULL AND p.nomor_telepon != ''")
    } else if (phoneFilter === 'no_phone') {
      whereConditions.push("(p.nomor_telepon IS NULL OR p.nomor_telepon = '')")
    }

    // Build ORDER BY clause
    let orderBy = "p.nama_pelanggan ASC"
    switch (sortBy) {
      case 'name_desc':
        orderBy = "p.nama_pelanggan DESC"
        break
      case 'points_desc':
        orderBy = "p.loyalty_points DESC, p.nama_pelanggan ASC"
        break
      case 'date_desc':
        orderBy = "p.dibuat_pada DESC"
        break
      case 'cuci_desc':
        orderBy = "p.total_cuci DESC, p.nama_pelanggan ASC"
        break
      default:
        orderBy = "p.nama_pelanggan ASC"
    }

    const whereClause = whereConditions.join(' AND ')

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM pelanggan p
      WHERE ${whereClause}
    `

    const countResult = await query(countQuery, searchQueryParams)
    const totalCustomers = countResult[0].total
    const totalPages = Math.ceil(totalCustomers / limit)

    // Main query - JOIN with cabang to get branch name
    const finalCustomerQuery = `
      SELECT
        p.id_pelanggan,
        p.id_cabang,
        p.nama_pelanggan,
        p.nomor_telepon,
        p.dibuat_pada,
        p.status_aktif,
        p.total_cuci,
        p.total_redeem,
        p.loyalty_points,
        (p.loyalty_points - p.total_redeem) as available_points,
        c.nama_cabang,
        c.alamat as alamat_cabang
      FROM pelanggan p
      LEFT JOIN cabang c ON p.id_cabang = c.id_cabang AND c.status_aktif = 'aktif'
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `

    const customers = await query(finalCustomerQuery, searchQueryParams)

    return NextResponse.json({
      customers,
      totalCustomers,
      totalPages,
      currentPage: page,
      itemsPerPage: limit,
      filters: {
        search,
        loyaltyFilter,
        phoneFilter,
        sortBy
      }
    })
  } catch (error) {
    console.error('Customers API error:', error)
    return NextResponse.json({ error: 'Database error', details: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    // Get auth token to get user's branch
    const token = request.cookies.get('auth-token')?.value
    let userBranchId = null
    let userRole = null

    if (token) {
      try {
        const user = verifyToken(token)
        if (user) {
          userRole = user.jenis_karyawan
          if (user.cabang_id) {
            userBranchId = user.cabang_id
          }
        }
      } catch (err) {
        // Invalid token, continue without auth
      }
    }

    const { nama_pelanggan, nomor_telepon, id_cabang } = await request.json()

    if (!nama_pelanggan || !nama_pelanggan.trim()) {
      return NextResponse.json({ error: 'Nama pelanggan wajib diisi' }, { status: 400 })
    }

    // Determine branch ID to use
    // For owner: use id_cabang from request body (required)
    // For kasir: use their branch ID (userBranchId)
    let finalBranchId = null

    if (userRole === 'owner') {
      // Owner must specify which branch
      if (!id_cabang) {
        return NextResponse.json({
          error: 'Cabang wajib dipilih',
          message: 'Silakan pilih cabang untuk pelanggan ini'
        }, { status: 400 })
      }
      finalBranchId = id_cabang
    } else {
      // Kasir and other roles use their own branch
      finalBranchId = userBranchId
    }

    // Check for duplicate name PER CABANG (case-insensitive, space-sensitive)
    let duplicateCheckQuery = `
      SELECT id_pelanggan, nama_pelanggan, nomor_telepon
      FROM pelanggan
      WHERE LOWER(nama_pelanggan) = LOWER(?) AND status_aktif = 'aktif'
    `
    let duplicateCheckParams = [nama_pelanggan.trim()]

    if (finalBranchId) {
      duplicateCheckQuery += ` AND id_cabang = ?`
      duplicateCheckParams.push(finalBranchId)
    }

    const existingName = await query(duplicateCheckQuery, duplicateCheckParams)

    if (existingName.length > 0) {
      const existing = existingName[0]
      let errorMsg = `Nama pelanggan "${existing.nama_pelanggan}" sudah terdaftar`
      if (finalBranchId) {
        errorMsg += ` di cabang ini`
      }
      if (existing.nomor_telepon) {
        errorMsg += ` dengan nomor HP ${existing.nomor_telepon}`
      }
      return NextResponse.json({
        error: 'Nama pelanggan sudah terdaftar',
        message: errorMsg
      }, { status: 409 })
    }

    // Validate and normalize phone number if provided
    let normalizedPhone = nomor_telepon
    if (nomor_telepon && nomor_telepon.trim()) {
      const phoneValidation = validatePhoneNumber(nomor_telepon)
      if (!phoneValidation.isValid) {
        return NextResponse.json({
          error: phoneValidation.error
        }, { status: 400 })
      }
      normalizedPhone = phoneValidation.sanitized

      // Check for duplicate phone number PER CABANG using normalized format
      let phoneCheckQuery = `
        SELECT id_pelanggan, nama_pelanggan
        FROM pelanggan
        WHERE nomor_telepon = ? AND status_aktif = 'aktif'
      `
      let phoneCheckParams = [normalizedPhone]

      if (finalBranchId) {
        phoneCheckQuery += ` AND id_cabang = ?`
        phoneCheckParams.push(finalBranchId)
      }

      const existingCustomer = await query(phoneCheckQuery, phoneCheckParams)

      if (existingCustomer.length > 0) {
        let errorMsg = `Nomor telepon ${normalizedPhone} sudah terdaftar`
        if (finalBranchId) {
          errorMsg += ` di cabang ini`
        }
        errorMsg += ` atas nama "${existingCustomer[0].nama_pelanggan}"`
        return NextResponse.json({
          error: 'Nomor telepon sudah digunakan',
          message: errorMsg
        }, { status: 409 })
      }
    }

    // Insert with id_cabang, loyalty_points column using normalized phone
    const result = await query(`
      INSERT INTO pelanggan (nama_pelanggan, nomor_telepon, id_cabang, loyalty_points, status_aktif, dibuat_pada)
      VALUES (?, ?, ?, 0, 'aktif', NOW())
    `, [nama_pelanggan.trim(), normalizedPhone || null, finalBranchId])

    const customer = {
      id_pelanggan: result.insertId,
      nama_pelanggan: nama_pelanggan.trim(),
      nomor_telepon: normalizedPhone || null,
      id_cabang: finalBranchId,
      loyalty_points: 0,
      dibuat_pada: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '.000Z',
      status_aktif: 'aktif'
    }

    return NextResponse.json(customer)
  } catch (error) {
    console.error('Create customer error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}