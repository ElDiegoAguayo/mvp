'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LOGIN_VARIANTS,
  LOGIN_VARIANT_COUNT,
  STORAGE_KEY,
  isValidVariantId,
  type LoginVariantId,
} from './constants'
import { renderLoginLayout } from './login-layouts'
import type { LoginFormBlockProps } from './login-parts'

function VariantSwitcher({
  active,
  onChange,
}: {
  active: LoginVariantId
  onChange: (v: LoginVariantId) => void
}) {
  return (
    <div className="login-switcher fixed bottom-0 inset-x-0 z-[100]">
      <div className="mx-auto w-full max-w-[min(100vw-0.5rem,90rem)] px-1.5 pb-2 pt-1">
        <div className="rounded-xl border border-white/15 bg-slate-900/95 backdrop-blur-xl shadow-2xl px-2 py-2">
          <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5">
            <span className="text-[9px] uppercase tracking-wider text-slate-500">UpCrop · 15 estilos</span>
            <span className="text-[9px] text-[#4063ca] font-medium truncate">
              {active}. {LOGIN_VARIANTS.find((v) => v.id === active)?.tag}
            </span>
          </div>
          <div className="login-switcher-grid">
            {LOGIN_VARIANTS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => onChange(v.id)}
                title={`Login ${v.id} · ${v.tag}`}
                className={cn(
                  'login-switcher-btn',
                  active === v.id && 'login-switcher-btn-active',
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function useLoginVariant() {
  const [variant, setVariant] = useState<LoginVariantId>(1)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const n = Number(stored)
      if (isValidVariantId(n)) setVariant(n)
    }
  }, [])

  const changeVariant = (v: LoginVariantId) => {
    if (!isValidVariantId(v)) return
    setVariant(v)
    localStorage.setItem(STORAGE_KEY, String(v))
  }

  return { variant, changeVariant }
}

export function LoginShowcase({
  variant,
  onVariantChange,
  formProps,
}: {
  variant: LoginVariantId
  onVariantChange: (v: LoginVariantId) => void
  formProps: Omit<LoginFormBlockProps, 'variant'>
}) {
  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow
    const prevBody = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = prevHtml
      document.body.style.overflow = prevBody
    }
  }, [])

  return (
    <div className="login-page-root fixed inset-0 overflow-hidden">
      <div key={variant} className="login-variant-enter h-full w-full">
        {renderLoginLayout(variant, formProps)}
      </div>
      <VariantSwitcher active={variant} onChange={onVariantChange} />
    </div>
  )
}

export { LOGIN_VARIANTS, LOGIN_VARIANT_COUNT, type LoginVariantId } from './constants'
