import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const IMO_PATTERN = /^\d{7}$/
const DEFAULT_API_BASE = 'https://api.jsoncargo.com/api/v1'

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

function resolveApiBase() {
  const configured = process.env.JSONCARGO_SHIP_TRACKING_URL?.trim()
  if (!configured) return DEFAULT_API_BASE
  return configured.replace(/\/+$/, '')
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')?.trim()
    const shippingLine = searchParams.get('shipping_line')?.trim()

    if (!query) {
      return NextResponse.json(
        { error: 'Falta el parametro de busqueda.', code: 'MISSING_QUERY' },
        { status: 400 },
      )
    }

    const apiKey = process.env.JSONCARGO_API_KEY?.trim()
    const apiBase = resolveApiBase()

    if (!apiKey) {
      console.error('Ship tracking: JSONCARGO_API_KEY is not configured')
      return NextResponse.json(
        {
          error:
            'Rastreo no configurado en el servidor. Falta la variable de entorno JSONCARGO_API_KEY en produccion.',
          code: 'MISSING_API_KEY',
        },
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
          {
            error: 'El parametro shipping_line es obligatorio para contenedores.',
            code: 'MISSING_SHIPPING_LINE',
          },
          { status: 400 },
        )
      }
      finalUrl = `${apiBase}/containers/${normalizedQuery}?shipping_line=${shippingLine}`
    }

    const upstreamResponse = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    const contentType = upstreamResponse.headers.get('content-type') || ''
    const rawBody = await upstreamResponse.text()

    if (upstreamResponse.status === 404) {
      let errorData: { title?: string } = {}
      if (rawBody) {
        try {
          errorData = JSON.parse(rawBody)
        } catch {
          errorData = {}
        }
      }
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
      console.error('JsonCargo non-JSON response:', upstreamResponse.status, rawBody.slice(0, 200))
      return NextResponse.json(
        { error: 'La API devolvio una respuesta no valida.', code: 'INVALID_UPSTREAM_RESPONSE' },
        { status: upstreamResponse.ok ? 502 : upstreamResponse.status },
      )
    }

    let data: unknown = null
    try {
      data = rawBody ? JSON.parse(rawBody) : null
    } catch (parseError) {
      console.error('JsonCargo parse error:', parseError)
      return NextResponse.json(
        { error: 'No se pudo interpretar la respuesta de JsonCargo.', code: 'PARSE_ERROR' },
        { status: 502 },
      )
    }

    if (!upstreamResponse.ok) {
      const errorMessage =
        typeof data === 'object' && data !== null && 'error' in data
          ? formatUpstreamError((data as { error?: unknown }).error)
          : 'Error al consultar JsonCargo.'
      console.error('JsonCargo upstream error:', upstreamResponse.status, errorMessage)
      return NextResponse.json(
        { error: errorMessage, code: 'UPSTREAM_ERROR' },
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
      {
        error: 'Error inesperado al consultar JsonCargo.',
        code: 'UNEXPECTED_ERROR',
      },
      { status: 500 },
    )
  }
}
