import { NextRequest, NextResponse } from 'next/server'

export const config = {
    matcher: ['/', '/((?!api/).*)'], // Protect everything except /api/*
}

export function middleware(req: NextRequest) {
    const authHeader = req.headers.get('authorization')

    if (authHeader) {
        const base64 = authHeader.split(' ')[1]
        const [user, pwd] = atob(base64).split(':')

        if (user === '4dmin' && pwd === 'testpwd123') {
            return NextResponse.next() // Authorized
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
