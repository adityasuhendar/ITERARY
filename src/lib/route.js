import { NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth'

export async function POST(request) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'Username dan password diperlukan' },
        { status: 400 }
      )
    }

    const result = await authenticateUser(username, password)

    if (!result.success) {
      return NextResponse.json(result, { status: 401 })
    }

    // Set HTTP-only cookie
    const response = NextResponse.json({
      success: true,
      user: result.user
    })

    response.cookies.set('auth-token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 // 24 hours
    })

    return response

  } catch (error) {
    console.error('Login API error:', error)
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// Logout endpoint
export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('auth-token')
  return response
}