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

        // Use env vars
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        const supabase = createServerClient(
            supabaseUrl,
            supabaseKey,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll()
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                        response = NextResponse.next({
                            request: {
                                headers: request.headers,
                            },
                        })
                        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
                    },
                },
            }
        )

        // Auth Check
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        // Debug logging
        if (request.nextUrl.pathname.startsWith('/admin')) {
            // console.log(`Middleware Auth Check [${request.nextUrl.pathname}]`);
            // console.log('User Found:', !!user);
            if (authError) console.log('Auth Error:', authError.message);
        }

        if (!user && request.nextUrl.pathname.startsWith('/admin')) {
            console.log('Middleware: Redirecting to login due to missing user.');
            const redirectUrl = request.nextUrl.clone()
            redirectUrl.pathname = '/admin/login'
            return NextResponse.redirect(redirectUrl)
        }

        return response
    } catch (e) {
        console.error('Middleware Execution Error:', e);
        // Fallback: Redirect to login on error
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
