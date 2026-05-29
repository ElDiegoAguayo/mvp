import Image from 'next/image'
import { Cpu, Globe, Ship, Bot } from 'lucide-react'
import type { ReactNode } from 'react'
import { LOGO_ICON, type LoginVariantId } from './constants'
import { THEMES } from './themes'
import type { LoginFormBlockProps } from './login-parts'
import {
  HeaderBar, HeroImage, LoginFormBlock,
  BrandMark, BrandStoryPanel, ModulePills,
} from './login-parts'
import { FusionLoginLayout } from './login-fusion-layout'
import {
  FxParticles, FxColdChainSteps, FxAiPulseRings,
  FxMouseLayer, FxParallaxLayer,
} from './login-fx'

type LayoutProps = {
  variant: LoginVariantId
  formProps: Omit<LoginFormBlockProps, 'variant'>
}

function FormCol({ variant, formProps, className }: LayoutProps & { className?: string }) {
  return (
    <div className={className ?? 'flex justify-center'}>
      <LoginFormBlock variant={variant} {...formProps} />
    </div>
  )
}

export function renderLoginLayout(variant: LoginVariantId, formProps: Omit<LoginFormBlockProps, 'variant'>): ReactNode {
  if (variant >= 13 && variant <= 15) {
    return <FusionLoginLayout variant={variant} formProps={formProps} />
  }

  const t = THEMES[variant]

  switch (variant) {
    case 1:
      return (
        <div className={`login-shell h-full w-full flex flex-col bg-grid ${t.page}`}>
          <HeaderBar variant={1} />
          <main className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center min-h-0 overflow-hidden gap-6 lg:gap-10">
            <div className="flex lg:hidden flex-col items-center text-center gap-1 mb-2 shrink-0">
              <Image src={LOGO_ICON} alt="" width={40} height={40} />
              <h1 className="text-lg font-bold text-slate-900">Welcome to Up Crop</h1>
            </div>
            <div className="hidden lg:flex flex-col flex-1 max-w-[48%] gap-5 min-h-0 justify-center pr-4">
              <h1 className="text-2xl xl:text-[2.35rem] font-bold leading-tight tracking-tight text-slate-900">
                Welcome to Up Crop
              </h1>
              <div className="rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/80">
                <HeroImage />
              </div>
              <p className={`text-sm ${t.footer}`}>UpCrop · Agri-Tech Exportadores</p>
            </div>
            <div className="flex w-full lg:w-auto justify-center items-center shrink-0 px-2">
              <LoginFormBlock variant={1} {...formProps} />
            </div>
          </main>
        </div>
      )

    case 2:
      return (
        <div className={`login-shell h-full w-full flex flex-col relative ${t.page}`}>
          <div className="login-scanlines pointer-events-none absolute inset-0 z-0 opacity-30" />
          <div className="login-orb login-orb-a pointer-events-none" />
          <div className="login-orb login-orb-b pointer-events-none" />
          <HeaderBar variant={2} />
          <main className="relative z-10 flex-1 flex flex-col lg:flex-row px-6 sm:px-10 lg:px-14 gap-10 lg:items-center">
            <div className="lg:w-1/2 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-medium">
                <Cpu className="w-3.5 h-3.5" />
                UP CROP ANALYTICS · Command Center
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
                Inteligencia agrícola
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#4063ca] to-cyan-400">en tiempo real</span>
              </h1>
              <HeroImage overlay="bg-gradient-to-t from-[#060b18] via-transparent to-transparent" />
            </div>
            <FormCol variant={2} formProps={formProps} className="lg:w-1/2 flex justify-center" />
          </main>
        </div>
      )

    case 3:
      return (
        <div className={`login-shell h-full w-full flex flex-col ${t.page}`}>
          <div className="absolute inset-0 z-0">
            <Image src="/login-hero.png" alt="" fill className="object-cover scale-105 blur-sm opacity-40" priority />
            <div className="absolute inset-0 bg-[#0e0d0b]/75" />
          </div>
          <HeaderBar variant={3} />
          <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 min-h-0 overflow-hidden">
            <div className="text-center mb-6 space-y-3 max-w-lg">
              <Image src={LOGO_ICON} alt="UpCrop" width={48} height={48} className="mx-auto login-pulse" priority />
              <h1 className="text-3xl sm:text-4xl font-bold lowercase">
                up<span className="text-[#4063ca]">crop</span>
              </h1>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Agri-Tech · Exportadores</p>
              <p className="text-slate-300 text-sm">Accede a tu ecosistema de gestión agrícola inteligente</p>
            </div>
            <LoginFormBlock variant={3} {...formProps} />
          </main>
        </div>
      )

    case 4:
      return (
        <div className={`login-shell h-full w-full flex flex-col relative ${t.page}`}>
          <div className="login-aurora-layer pointer-events-none" />
          <HeaderBar variant={4} />
          <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
            <BrandMark size="md" className="mb-8" />
            <LoginFormBlock variant={4} {...formProps} />
          </main>
        </div>
      )

    case 5:
      return (
        <div className={`login-shell h-full w-full flex flex-col relative ${t.page}`}>
          <div className="login-horizon-line pointer-events-none" />
          <HeaderBar variant={5} />
          <main className="relative z-10 flex-1 flex flex-col lg:flex-row items-end lg:items-center justify-center px-6 gap-12">
            <BrandStoryPanel
              icon={Globe}
              eyebrow="Comercio exterior"
              title="Exportación inteligente"
              description="Embarques, documentos aduaneros y checklist operativo para llevar tu fruta al mercado global."
            />
            <LoginFormBlock variant={5} {...formProps} />
          </main>
        </div>
      )

    case 6:
      return (
        <FxMouseLayer variant="glow" className={`login-shell h-full w-full flex flex-col relative overflow-hidden ${t.page}`}>
          <div className="login-v26-dots pointer-events-none absolute inset-0 z-0" aria-hidden />
          <HeaderBar variant={6} />
          <main className="relative z-10 flex-1 flex min-h-0 overflow-hidden items-center justify-center">
            <div className="flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-10 w-full max-w-5xl px-3 sm:px-6 min-h-0">
              <div className="login-v26-brand hidden lg:flex flex-col gap-3 max-w-[300px] shrink min-h-0">
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
              <div className="lg:hidden text-center shrink-0">
                <p className="text-sm font-bold">Del campo al puerto</p>
                <p className="text-[10px] text-slate-500">Logística agro exportador</p>
              </div>
              <div className="login-v26-form shrink-0 w-full max-w-[380px]">
                <LoginFormBlock variant={6} {...formProps} />
              </div>
            </div>
          </main>
        </FxMouseLayer>
      )

    case 7:
      return (
        <FxMouseLayer variant="grid" className={`login-shell h-full w-full flex flex-col relative overflow-hidden ${t.page}`}>
          <FxAiPulseRings />
          <HeaderBar variant={7} />
          <main className="relative z-10 flex-1 flex min-h-0 overflow-hidden items-center justify-center">
            <div className="flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-10 w-full max-w-5xl px-3 sm:px-6 min-h-0">
              <div className="login-v28-brand hidden lg:flex flex-col gap-3 max-w-[320px] shrink min-h-0">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-[#4063ca]/40 bg-[#4063ca]/15 text-[#a5b8ff] text-[10px] font-medium w-fit">
                  <Bot className="w-3.5 h-3.5" />
                  IA UpCrop · Online
                </div>
                <h1 className="text-2xl xl:text-3xl font-bold leading-tight">
                  Inteligencia<br />
                  <span className="login-fx-gradient-text">para exportadores</span>
                </h1>
                <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">
                  Análisis, alertas y asistente inteligente para tu operación agroindustrial.
                </p>
                <ModulePills modules={['Análisis', 'Alertas', 'Docs', 'Chat IA']} className="!gap-1" />
              </div>
              <div className="lg:hidden text-center shrink-0 space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[#4063ca]/30 bg-[#4063ca]/10 text-[#a5b8ff] text-[9px]">
                  <Bot className="w-3 h-3" />
                  IA UpCrop
                </div>
              </div>
              <div className="login-v28-form shrink-0 w-full max-w-[380px]">
                <LoginFormBlock variant={7} {...formProps} />
              </div>
            </div>
          </main>
        </FxMouseLayer>
      )

    case 8:
      return (
        <div className={`login-shell h-full w-full flex flex-col relative overflow-hidden ${t.page}`}>
          <div className="login-v30-aurora pointer-events-none absolute inset-0 z-0" aria-hidden />
          <div className="login-v30-noise pointer-events-none absolute inset-0 z-0" aria-hidden />
          <div className="login-v30-spin-bg pointer-events-none absolute inset-0 z-0 flex items-center justify-center" aria-hidden>
            <Image
              src={LOGO_ICON}
              alt=""
              width={520}
              height={520}
              className="login-v30-spin-logo w-[min(520px,58vh)] h-auto max-w-[85vw] opacity-[0.14]"
            />
          </div>
          <HeaderBar variant={8} />
          <main className="relative z-10 flex-1 flex min-h-0 overflow-hidden items-center justify-center">
            <div className="login-v30-layout flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-12 w-full max-w-5xl px-3 sm:px-6 min-h-0 max-h-full">
              <div className="login-v30-brand hidden lg:flex flex-col gap-2.5 max-w-[340px] shrink min-h-0 overflow-hidden">
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
              <div className="lg:hidden text-center shrink-0">
                <p className="text-base font-bold lowercase">up<span className="text-[#4063ca]">crop</span></p>
                <p className="text-[10px] text-slate-500 mt-0.5">Plataforma agro exportador</p>
              </div>
              <div className="login-v30-form-wrap shrink-0 w-full max-w-[380px]">
                <LoginFormBlock variant={8} {...formProps} />
              </div>
            </div>
          </main>
        </div>
      )

    case 9:
      return (
        <FxMouseLayer variant="glow" className={`login-shell h-full w-full flex flex-col relative overflow-hidden ${t.page}`}>
          <HeaderBar variant={9} />
          <main className="relative z-10 flex-1 flex min-h-0 items-center justify-center">
            <div className="text-center space-y-3 mb-3 lg:mb-0 lg:absolute lg:left-[clamp(1rem,8vw,6rem)] lg:top-1/2 lg:-translate-y-1/2 lg:text-left lg:max-w-xs hidden lg:block">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#4063ca]">Efecto cursor</p>
              <h1 className="text-2xl font-bold leading-tight">Mueve el mouse<br />por la pantalla</h1>
            </div>
            <LoginFormBlock variant={9} {...formProps} />
          </main>
        </FxMouseLayer>
      )

    case 10:
      return (
        <FxMouseLayer variant="glow" ripples className={`login-shell h-full w-full flex flex-col relative overflow-hidden ${t.page}`}>
          <HeaderBar variant={10} />
          <main className="relative z-10 flex-1 flex min-h-0 items-center justify-center">
            <div className="relative w-full max-w-[400px] px-3">
              <p className="text-center text-[10px] text-[#a5b8ff] mb-2 uppercase tracking-widest hidden sm:block">Ondas al mover el cursor</p>
              <LoginFormBlock variant={10} {...formProps} />
            </div>
          </main>
        </FxMouseLayer>
      )

    case 11:
      return (
        <FxMouseLayer variant="aurora" className={`login-shell h-full w-full flex flex-col relative overflow-hidden ${t.page}`}>
          <div className="login-v35-noise pointer-events-none absolute inset-0 z-0" aria-hidden />
          <HeaderBar variant={11} />
          <main className="relative z-10 flex-1 flex min-h-0 items-center justify-center">
            <div className="flex flex-col items-center gap-3 w-full max-w-[400px] px-3">
              <BrandMark size="sm" className="lg:hidden" />
              <LoginFormBlock variant={11} {...formProps} />
            </div>
          </main>
        </FxMouseLayer>
      )

    case 12:
      return (
        <FxMouseLayer variant="nebula" trail className={`login-shell h-full w-full flex flex-col relative overflow-hidden ${t.page}`}>
          <FxParticles density={36} className="opacity-30" />
          <HeaderBar variant={12} />
          <main className="relative z-10 flex-1 flex min-h-0 items-center justify-center">
            <div className="flex flex-col items-center gap-3 w-full max-w-[400px] px-3">
              <FxParallaxLayer depth={8} className="text-center space-y-1 mb-1">
                <Image src={LOGO_ICON} alt="UpCrop" width={44} height={44} className="mx-auto login-pulse" priority />
                <p className="text-sm font-bold lowercase">up<span className="text-[#4063ca]">crop</span></p>
                <p className="text-[10px] text-[#a5b8ff] uppercase tracking-widest">Estela de cometa</p>
              </FxParallaxLayer>
              <LoginFormBlock variant={12} {...formProps} />
            </div>
          </main>
        </FxMouseLayer>
      )

    default:
      return null
  }
}
