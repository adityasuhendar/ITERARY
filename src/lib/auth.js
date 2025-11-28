import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { NextResponse } from 'next/server'
import { query } from './database'

export async function hashPassword(password) {
  return await bcrypt.hash(password, 12)
}

export async function verifyPassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword)
}

export function createToken(payload, rememberMe = false) {
  console.log('Creating token with payload:', payload)
  console.log('JWT_SECRET available:', process.env.JWT_SECRET ? 'yes' : 'no')
  
  // Tentukan durasi token berdasarkan rememberMe dan jenis karyawan
  let expiresIn = '24h' // default
  
  if (rememberMe) {
    // Remember Me: 30 hari untuk semua role
    expiresIn = '30d'
  } else {
    // Durasi normal berdasarkan role
    if (payload.jenis_karyawan === 'kasir' || payload.jenis_karyawan === 'collector') {
      expiresIn = '8h' // 8 jam untuk kasir dan collector
    } else if (payload.jenis_karyawan === 'owner' || payload.jenis_karyawan === 'super_admin' || payload.jenis_karyawan === 'investor') {
      expiresIn = '1h' // 1 jam untuk owner dan super admin (testing - originally 1h)
    }
  }
  
  console.log(`Creating token for ${payload.jenis_karyawan} with duration: ${expiresIn} (rememberMe: ${rememberMe})`)
  
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn })
  console.log('Token created:', token ? token.substring(0, 20) + '...' : 'null')
  return token
}

export function verifyToken(token) {
  try {
    console.log('Verifying token with JWT_SECRET:', process.env.JWT_SECRET ? 'present' : 'missing')
    console.log('Token to verify:', token ? token.substring(0, 20) + '...' : 'null')
    const result = jwt.verify(token, process.env.JWT_SECRET)
    console.log('Token verification successful:', result)
    return result
  } catch (error) {
    console.log('Token verification failed:', error.message)
    return null
  }
}

export async function authenticateUser(username, password, rememberMe = false) {
  try {
    // Get user from database with cabang info
    const users = await query(
      `SELECT k.*, c.nama_cabang, c.id_cabang as cabang_id, r.nama_role 
       FROM karyawan k 
       LEFT JOIN cabang c ON k.id_cabang = c.id_cabang
       JOIN role_permissions r ON k.id_role = r.id_role
       WHERE k.username = ? AND k.status_aktif = 'aktif'`,
      [username]
    )

    if (users.length === 0) {
      return { success: false, message: 'User tidak ditemukan' }
    }

    const user = users[0]

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash)
    if (!isValid) {
      return { success: false, message: 'Password salah' }
    }

    // Update last login
    await query(
      'UPDATE karyawan SET terakhir_login = NOW() WHERE id_karyawan = ?',
      [user.id_karyawan]
    )

    // Create session data with cabang_id
    const sessionData = {
      id: user.id_karyawan,
      username: user.username || '',
      name: user.nama_karyawan || '',
      jenis_karyawan: user.jenis_karyawan || '',
      role: user.jenis_karyawan || '',
      cabang: user.nama_cabang || null,
      cabang_id: user.id_cabang || null,
      active_worker_name: user.nama_karyawan || '',
      nomor_telepon: user.nomor_telepon || null
    }

    // Only add shift for kasir and collector, not for owner/super_admin
    if (user.jenis_karyawan === 'kasir' || user.jenis_karyawan === 'collector') {
      sessionData.shift = user.shift || null
    }
    
    console.log('Creating session data:', sessionData)

    const token = createToken(sessionData, rememberMe)

    return { 
      success: true, 
      user: sessionData,
      token 
    }

  } catch (error) {
    console.error('Authentication error:', error)
    return { success: false, message: 'Terjadi kesalahan sistem' }
  }
}

export async function getUserFromToken(token) {
  try {
    const decoded = verifyToken(token)
    if (!decoded) return null

    const users = await query(
      `SELECT k.*, c.id_cabang as cabang_id, c.nama_cabang 
       FROM karyawan k 
       LEFT JOIN cabang c ON k.id_cabang = c.id_cabang
       WHERE k.id_karyawan = ?`,
      [decoded.id]
    )

    return users[0] || null
  } catch (error) {
    return null
  }
}

