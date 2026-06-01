import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    const errorUrl = new URL(`${origin}/auth/error`)
    errorUrl.searchParams.set('reason', error.message)
    return NextResponse.redirect(errorUrl.toString())
  }

  const authError =
    searchParams.get('error_description') ??
    searchParams.get('error') ??
    searchParams.get('reason')

  if (authError) {
    const errorUrl = new URL(`${origin}/auth/error`)
    errorUrl.searchParams.set('reason', authError)
    return NextResponse.redirect(errorUrl.toString())
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
