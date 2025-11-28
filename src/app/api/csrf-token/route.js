import { NextResponse } from 'next/server'
import { generateCSRFToken, getCSRFToken } from '@/lib/csrf'
import { verifyToken } from '@/lib/auth'

export async function GET(request) {
  try {
    // Only authenticated users can get CSRF tokens
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 403 })
    }

    // Get or generate CSRF token
    const csrfToken = getCSRFToken(request)
    
    const response = NextResponse.json({
      success: true,
      csrfToken: csrfToken
    })

    // Set CSRF token in HTTP-only cookie (if new)
    if (!request.cookies.get('csrf-token')?.value) {
      response.cookies.set('csrf-token', csrfToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 // 24 hours
      })
    }

    return response

  } catch (error) {
    console.error('CSRF token generation error:', error)
    return NextResponse.json({
      error: 'Failed to generate CSRF token'
    }, { status: 500 })
  }
}