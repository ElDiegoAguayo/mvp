import { VIEW_AS_COOKIE } from '@/lib/impersonation'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/** Server Actions POST to the current page; middleware redirects break their response. */
function isServerActionRequest(request: NextRequest): boolean {
  if (request.method !== 'POST') return false
  return (
    request.headers.has('next-action') ||
    request.headers.has('Next-Action') ||
    request.headers.has('x-action')
  )
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isProtected =
    pathname.startsWith('/dashboard') || pathname.startsWith('/admin')

  if (isProtected && !user) {
    if (isServerActionRequest(request)) {
      return supabaseResponse
    }
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    const response = NextResponse.redirect(url)
    response.cookies.delete(VIEW_AS_COOKIE)
    return response
  }

  // If the user is authenticated, verify their account is still active.
  // A blocked account must be signed out everywhere, including stale sessions.
  if (user) {
    const [{ data: profile }, { data: maintenance }] = await Promise.all([
      supabase
        .from('profiles')
        .select('is_active, role')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('platform_maintenance')
        .select('enabled, message')
        .eq('id', 1)
        .maybeSingle(),
    ])

    const maintenanceActive = Boolean(maintenance?.enabled)
    const isClientUser = profile?.role === 'user'

    if (maintenanceActive && isClientUser) {
      const onAuthPage =
        pathname.startsWith('/auth/login') || pathname.startsWith('/auth/registro')

      if (pathname.startsWith('/dashboard') || onAuthPage) {
        await supabase.auth.signOut()

        if (!pathname.startsWith('/auth/login') || request.nextUrl.searchParams.get('maintenance') !== '1') {
          const url = request.nextUrl.clone()
          url.pathname = '/auth/login'
          url.searchParams.set('maintenance', '1')
          return NextResponse.redirect(url)
        }
      }
    }

    if (profile && profile.is_active === false) {
      await supabase.auth.signOut()

      if (isProtected) {
        const url = request.nextUrl.clone()
        url.pathname = '/auth/login'
        url.searchParams.set('blocked', '1')
        return NextResponse.redirect(url)
      }
    } else if (
      pathname.startsWith('/auth/login') &&
      !(maintenanceActive && isClientUser) &&
      !isServerActionRequest(request)
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  if (!user && request.cookies.get(VIEW_AS_COOKIE)) {
    supabaseResponse.cookies.delete(VIEW_AS_COOKIE)
  }

  return supabaseResponse
}
