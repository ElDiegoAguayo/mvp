import { NextResponse } from 'next/server'
import { geocodeAddress } from '@/lib/tech-assistance/geocode'

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q')?.trim()
  if (!q) {
    return NextResponse.json({ ok: false, message: 'Query vacía.' }, { status: 400 })
  }

  try {
    const result = await geocodeAddress(q)
    if (!result) {
      return NextResponse.json({ ok: false, message: 'No se encontró la ubicación.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, ...result })
  } catch {
    return NextResponse.json({ ok: false, message: 'Error al geocodificar.' }, { status: 502 })
  }
}
