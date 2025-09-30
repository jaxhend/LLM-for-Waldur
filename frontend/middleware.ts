import { NextRequest, NextResponse } from 'next/server'

export const config = {
    matcher: ['/', '/((?!api/).*)'], // Protect everything except /api/*
}

export function middleware(req: NextRequest) {
    const authHeader = req.headers.get('authorization')

    const BASIC_USER = process.env.BASIC_AUTH_USER
    const BASIC_PASSWORD = process.env.BASIC_AUTH_PASSWORD

    if (!BASIC_USER || !BASIC_PASSWORD) {
        console.warn('BASIC_USER or BASIC_PASSWORD is not set in environment variables.')
        return NextResponse.next() // Allow access if credentials are not set
    }

    if (authHeader) {
        const [scheme, encoded] = authHeader.split(' ')
        if (scheme === 'Basic' && encoded) {
            const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
            const [user, pwd] = decoded.split(':')

            if (user === BASIC_USER && pwd === BASIC_PASSWORD) {
                return NextResponse.next() // Authorized
            }
        }
    }

    // Unauthorized: trigger browser Basic Auth prompt
    return new NextResponse('Authentication required', {
        status: 401,
        headers: {
            'WWW-Authenticate': 'Basic realm="Secure Area"',
        },
    })
}
