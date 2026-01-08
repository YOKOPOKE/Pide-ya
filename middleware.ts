import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    try {
        let response = NextResponse.next({
            request: {
                headers: request.headers,
            },
        })

        // Only run on admin routes
        if (!request.nextUrl.pathname.startsWith('/admin')) {
            return response;
        }

        // Skip logic on login page
        if (request.nextUrl.pathname === '/admin/login') {
            return response;
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.error('Middleware Error: Missing Supabase Environment Variables');
            // If we can't check auth, we better redirect to login anyway to be safe, 
            // or return a friendly error. For now, let's redirect to login which might have
            // its own connection logic or at least fail gracefully client-side.
            const redirectUrl = request.nextUrl.clone()
            redirectUrl.pathname = '/admin/login'
            return NextResponse.redirect(redirectUrl)
        }

        const supabase = createServerClient(
            supabaseUrl,
            supabaseKey,
            {
                cookies: {
                    get(name: string) {
                        return request.cookies.get(name)?.value
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        request.cookies.set({
                            name,
                            value,
                            ...options,
                        })
                        response = NextResponse.next({
                            request: {
                                headers: request.headers,
                            },
                        })
                        response.cookies.set({
                            name,
                            value,
                            ...options,
                        })
                    },
                    remove(name: string, options: CookieOptions) {
                        request.cookies.set({
                            name,
                            value: '',
                            ...options,
                        })
                        response = NextResponse.next({
                            request: {
                                headers: request.headers,
                            },
                        })
                        response.cookies.set({
                            name,
                            value: '',
                            ...options,
                        })
                    },
                },
            }
        )

        const { data: { user } } = await supabase.auth.getUser()

        if (!user && request.nextUrl.pathname.startsWith('/admin')) {
            const redirectUrl = request.nextUrl.clone()
            redirectUrl.pathname = '/admin/login'
            return NextResponse.redirect(redirectUrl)
        }

        return response
    } catch (e) {
        console.error('Middleware Execution Error:', e);
        // Fallback: If middleware fails, letting the request pass MIGHT be insecure for Admin,
        // so safer to redirect to login.
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/admin/login'
        return NextResponse.redirect(redirectUrl)
    }
}

export const config = {
    matcher: [
        '/admin/:path*',
    ],
}
