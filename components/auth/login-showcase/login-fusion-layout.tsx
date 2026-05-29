'use client'

import Image from 'next/image'
import { Globe, Ship } from 'lucide-react'
import { LOGO_ICON, type LoginVariantId } from './constants'
import type { LoginFormBlockProps } from './login-parts'
import {
  HeaderBar, LoginFormBlock, BrandStoryPanel, ModulePills,
} from './login-parts'
import { FxColdChainSteps, FxMouseLayer } from './login-fx'
import { getFusionConfig, type FusionConfig, type FusionPanel } from './login-fusions'
import { THEMES } from './themes'

function FusionBackgrounds({ cfg }: { cfg: FusionConfig }) {
  return (
    <>
      {cfg.backgrounds.includes('horizon') && (
        <div className="login-horizon-line pointer-events-none absolute inset-0 z-0" aria-hidden />
      )}
      {cfg.backgrounds.includes('dots') && (
        <div className="login-v26-dots pointer-events-none absolute inset-0 z-0" aria-hidden />
      )}
      {cfg.backgrounds.includes('aurora') && (
        <div className="login-v30-aurora pointer-events-none absolute inset-0 z-0" aria-hidden />
      )}
      {cfg.backgrounds.includes('noise') && (
        <div className="login-v30-noise pointer-events-none absolute inset-0 z-0" aria-hidden />
      )}
      {cfg.backgrounds.includes('spin') && (
        <div className="login-v30-spin-bg pointer-events-none absolute inset-0 z-0 flex items-center justify-center" aria-hidden>
          <Image
            src={LOGO_ICON}
            alt=""
            width={520}
            height={520}
            className="login-v30-spin-logo w-[min(520px,58vh)] h-auto max-w-[85vw]"
            style={{ opacity: cfg.spinOpacity ?? 0.11 }}
          />
        </div>
      )}
    </>
  )
}

function FusionPanel({ panel }: { panel: FusionPanel }) {
  switch (panel) {
    case 'horizon-export':
      return (
        <div className="login-fusion-brand hidden lg:flex flex-col gap-3 max-w-[320px] shrink min-h-0">
          <BrandStoryPanel
            icon={Globe}
            eyebrow="Comercio exterior"
            title="Exportación inteligente"
            description="Embarques, documentos aduaneros y checklist operativo para llevar tu fruta al mercado global."
          />
        </div>
      )
    case 'cold-chain':
      return (
        <div className="login-fusion-brand hidden lg:flex flex-col gap-3 max-w-[300px] shrink min-h-0">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-[#4063ca]/35 bg-[#4063ca]/10 text-[#a5b8ff] text-[10px] font-medium w-fit">
            <Ship className="w-3 h-3" />
            Cadena de frío · Logística
          </div>
          <h1 className="text-2xl xl:text-3xl font-bold leading-tight">
            Del campo<br />
            <span className="login-fx-gradient-text">al puerto</span>
          </h1>
          <FxColdChainSteps />
        </div>
      )
    case 'master-brand':
      return (
        <div className="login-fusion-brand hidden lg:flex flex-col gap-2.5 max-w-[340px] shrink min-h-0 overflow-hidden">
          <div className="flex items-center gap-2.5">
            <Image src={LOGO_ICON} alt="UpCrop" width={40} height={40} className="shrink-0" priority />
            <div>
              <p className="text-lg font-bold lowercase leading-none">up<span className="text-[#4063ca]">crop</span></p>
              <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500 mt-0.5">Agri-Tech · Exportadores</p>
            </div>
          </div>
          <h1 className="text-2xl xl:text-3xl font-bold leading-tight">
            Tu empresa,<br />
            <span className="text-[#4063ca]">toda en un lugar</span>
          </h1>
          <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">
            Producción, cosecha, costos, comercio exterior, documentos e IA para el agro exportador.
          </p>
          <ModulePills modules={['Producción', 'Comex', 'Costos', 'Cosecha', 'Bóveda', 'IA']} className="login-v30-pills !gap-1" />
        </div>
      )
    case 'export-chain':
      return (
        <div className="login-fusion-brand hidden lg:flex flex-col gap-4 max-w-[340px] shrink min-h-0">
          <BrandStoryPanel
            icon={Globe}
            eyebrow="Comercio exterior"
            title="Del huerto al mundo"
            description="Exportación inteligente con trazabilidad logística de punta a punta."
          />
          <FxColdChainSteps />
        </div>
      )
    case 'master-export':
      return (
        <div className="login-fusion-brand hidden lg:flex flex-col gap-3 max-w-[340px] shrink min-h-0">
          <div className="flex items-center gap-2.5">
            <Image src={LOGO_ICON} alt="UpCrop" width={36} height={36} className="shrink-0" priority />
            <p className="text-base font-bold lowercase">up<span className="text-[#4063ca]">crop</span></p>
          </div>
          <BrandStoryPanel
            icon={Globe}
            eyebrow="Fusión exportador"
            title="Operación global unificada"
            description="La plataforma que conecta tu cadena de frío con el comercio exterior."
          />
          <ModulePills modules={['Comex', 'Logística', 'Costos', 'Docs']} className="!gap-1" />
        </div>
      )
    case 'chain-horizon':
      return (
        <div className="login-fusion-brand hidden lg:flex flex-col gap-3 max-w-[300px] shrink min-h-0">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-[#4063ca]/35 bg-[#4063ca]/10 text-[#a5b8ff] text-[10px] font-medium w-fit">
            <Ship className="w-3 h-3" />
            Ruta exportadora
          </div>
          <h1 className="text-2xl font-bold leading-tight">
            Campo → Puerto → <span className="text-[#4063ca]">Mundo</span>
          </h1>
          <FxColdChainSteps />
          <p className="text-slate-500 text-[11px] leading-relaxed">Horizonte global · Cadena de frío · UpCrop</p>
        </div>
      )
    case 'master-chain':
      return (
        <div className="login-fusion-brand hidden lg:flex flex-col gap-3 max-w-[320px] shrink min-h-0">
          <div className="flex items-center gap-2.5">
            <Image src={LOGO_ICON} alt="UpCrop" width={40} height={40} className="shrink-0" priority />
            <div>
              <p className="text-lg font-bold lowercase leading-none">up<span className="text-[#4063ca]">crop</span></p>
              <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500 mt-0.5">Logística · Export</p>
            </div>
          </div>
          <FxColdChainSteps />
          <ModulePills modules={['Huerto', 'Frío', 'Puerto', 'Comex']} className="!gap-1" />
        </div>
      )
    case 'compact-export':
      return (
        <div className="login-fusion-brand hidden lg:flex flex-col gap-2 max-w-[280px] shrink min-h-0 text-center lg:text-left">
          <Image src={LOGO_ICON} alt="UpCrop" width={44} height={44} className="login-pulse" priority />
          <p className="text-sm font-bold lowercase">up<span className="text-[#4063ca]">crop</span></p>
          <p className="text-xs text-slate-400">Export · Cadena de frío · Horizonte global</p>
        </div>
      )
    case 'none':
      return null
    default:
      return null
  }
}

function FusionMobileHint({ panel }: { panel: FusionPanel }) {
  if (panel === 'none') {
    return (
      <div className="lg:hidden text-center shrink-0 mb-2">
        <Image src={LOGO_ICON} alt="UpCrop" width={36} height={36} className="mx-auto mb-1" priority />
        <p className="text-sm font-bold lowercase">up<span className="text-[#4063ca]">crop</span></p>
      </div>
    )
  }
  return (
    <div className="lg:hidden text-center shrink-0 mb-1">
      <p className="text-sm font-bold lowercase">up<span className="text-[#4063ca]">crop</span></p>
      <p className="text-[10px] text-slate-500">Fusión Horizon · Chain · Master</p>
    </div>
  )
}

function FusionMain({
  variant,
  cfg,
  formProps,
}: {
  variant: LoginVariantId
  cfg: FusionConfig
  formProps: Omit<LoginFormBlockProps, 'variant'>
}) {
  const mainClass =
    cfg.layout === 'bottom-split'
      ? 'relative z-10 flex-1 flex flex-col lg:flex-row items-end lg:items-center justify-center px-3 sm:px-6 gap-4 lg:gap-10 min-h-0 overflow-hidden'
      : cfg.layout === 'center'
        ? 'relative z-10 flex-1 flex flex-col items-center justify-center px-3 min-h-0 overflow-hidden gap-3'
        : 'relative z-10 flex-1 flex min-h-0 overflow-hidden items-center justify-center'

  const innerClass =
    cfg.layout === 'center'
      ? 'flex flex-col items-center w-full max-w-[400px] px-3'
      : 'flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-10 w-full max-w-5xl px-3 sm:px-6 min-h-0'

  return (
    <main className={mainClass}>
      <div className={innerClass}>
        <FusionMobileHint panel={cfg.panel} />
        <FusionPanel panel={cfg.panel} />
        <div className="login-fusion-form shrink-0 w-full max-w-[380px]">
          <LoginFormBlock variant={variant} {...formProps} />
        </div>
      </div>
    </main>
  )
}

export function FusionLoginLayout({
  variant,
  formProps,
}: {
  variant: LoginVariantId
  formProps: Omit<LoginFormBlockProps, 'variant'>
}) {
  const cfg = getFusionConfig(variant)
  if (!cfg) return null

  const t = THEMES[variant]
  const shell = (
    <>
      <FusionBackgrounds cfg={cfg} />
      <HeaderBar variant={variant} />
      <FusionMain variant={variant} cfg={cfg} formProps={formProps} />
    </>
  )

  if (cfg.mouse) {
    return (
      <FxMouseLayer
        variant={cfg.mouse.variant}
        ripples={cfg.mouse.ripples}
        trail={cfg.mouse.trail}
        className={`login-shell h-full w-full flex flex-col relative overflow-hidden ${t.page}`}
      >
        {shell}
      </FxMouseLayer>
    )
  }

  return (
    <div className={`login-shell h-full w-full flex flex-col relative overflow-hidden ${t.page}`}>
      {shell}
    </div>
  )
}
