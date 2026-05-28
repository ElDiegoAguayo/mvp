import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const IMO_PATTERN = /^\d{7}$/
const DEFAULT_COORDS = { lat: 8.983, lng: -79.516 }

const formatUpstreamError = (value: unknown) => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    if ('message' in value && typeof (value as { message?: unknown }).message === 'string') {
      return (value as { message: string }).message
    }
    try {
      return JSON.stringify(value)
    } catch {
      return 'Error al consultar JsonCargo.'
    }
  }
  return 'Error al consultar JsonCargo.'
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')?.trim()
    const shippingLine = searchParams.get('shipping_line')?.trim()

    if (!query) {
      return NextResponse.json(
        { error: 'Falta el parametro de busqueda.' },
        { status: 400 },
      )
    }

    const apiKey = process.env.JSONCARGO_API_KEY
    const apiBase = 'https://api.jsoncargo.com/api/v1'

    if (!apiKey) {
      return NextResponse.json(
        { error: 'No se encontro la configuracion de JsonCargo.' },
        { status: 500 },
      )
    }

    const isImo = IMO_PATTERN.test(query)
    const normalizedQuery = isImo ? query : query.toUpperCase()

    let finalUrl = ''
    if (isImo) {
      finalUrl = `${apiBase}/vessel/pro?imo=${normalizedQuery}`
    } else {
      if (!shippingLine) {
        return NextResponse.json(
          { error: 'El parametro shipping_line es obligatorio para contenedores.' },
          { status: 400 },
        )
      }
      finalUrl = `${apiBase}/containers/${normalizedQuery}?shipping_line=${shippingLine}`
    }

    const upstreamResponse = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.JSONCARGO_API_KEY ?? '',
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    const contentType = upstreamResponse.headers.get('content-type') || ''
    const rawBody = await upstreamResponse.text()

    if (upstreamResponse.status === 404) {
      const errorData = rawBody ? JSON.parse(rawBody) : {}
      return NextResponse.json(
        {
          error: `JsonCargo dice 404: ${errorData.title || 'No encontrado'}`,
          debug:
            'Si ves esto, la API respondió pero no tiene el barco en su base de datos aún.',
          status: upstreamResponse.status,
        },
        { status: 404 },
      )
    }

    if (!contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'La API devolvio una respuesta no valida.' },
        { status: upstreamResponse.ok ? 502 : upstreamResponse.status },
      )
    }

    let data: unknown = null
    try {
      data = rawBody ? JSON.parse(rawBody) : null
    } catch (parseError) {
      console.error('JsonCargo parse error:', parseError)
      return NextResponse.json(
        { error: 'No se pudo interpretar la respuesta de JsonCargo.' },
        { status: 502 },
      )
    }

    if (!upstreamResponse.ok) {
      const errorMessage =
        typeof data === 'object' && data !== null && 'error' in data
          ? formatUpstreamError((data as { error?: unknown }).error)
          : 'Error al consultar JsonCargo.'
      return NextResponse.json(
        { error: errorMessage },
        { status: upstreamResponse.status },
      )
    }

    const payload = data as Record<string, unknown>
    const payloadData = (payload?.data ?? payload) as Record<string, unknown>
    const latValue = payloadData?.lat ?? payloadData?.latitude
    const lonValue = payloadData?.lon ?? payloadData?.lng ?? payloadData?.longitude
    const lastLocation = payloadData?.last_location ?? payloadData?.lastLocation

    const lat = typeof latValue === 'string' ? Number(latValue) : latValue
    const lng = typeof lonValue === 'string' ? Number(lonValue) : lonValue

    if (typeof lat === 'number' && !Number.isNaN(lat) && typeof lng === 'number' && !Number.isNaN(lng)) {
      return NextResponse.json({
        ...payloadData,
        lat,
        lng,
      })
    }

    if (!isImo && lastLocation) {
      return NextResponse.json({
        ...payloadData,
        status: `Ultima ubicacion: ${String(lastLocation)}`,
      })
    }

    return NextResponse.json(payloadData)
  } catch (error) {
    console.error('Ship tracking error:', error)
    return NextResponse.json(
      { error: 'Error inesperado al consultar JsonCargo.' },
      { status: 500 },
    )
  }
}
