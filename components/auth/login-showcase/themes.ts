import type { LoginVariantId } from './constants'

export type ThemeTokens = {
  isLight: boolean
  page: string
  label: string
  input: string
  button: string
  buttonDisabled: string
  title: string
  subtitle: string
  footer: string
  alert: string
  logoText: string
  siteLink: string
  formCard?: string
}

const darkInput =
  'pl-10 h-[46px] bg-white/5 border-white/10 text-white placeholder:text-slate-500 rounded-lg focus:border-[#4063ca] focus-visible:ring-[#4063ca]/25'
const darkBase = {
  isLight: false,
  label: 'text-slate-300 font-medium text-sm',
  buttonDisabled: 'bg-slate-600 cursor-not-allowed',
  title: 'text-white',
  subtitle: 'text-slate-400',
  footer: 'text-slate-500',
  alert: 'bg-red-950/50 border-red-500/30 text-red-200',
  logoText: 'text-white',
  siteLink: 'border-[#4063ca]/30 bg-[#4063ca]/10 text-[#a5b8ff] hover:bg-[#4063ca]/20',
} satisfies Partial<ThemeTokens>

const lightInput =
  'pl-10 h-[46px] bg-[#EEF2FF] border-slate-200/80 text-slate-900 placeholder:text-slate-400 rounded-lg focus:border-[#4063ca] focus-visible:ring-[#4063ca]/20'
const lightBase = {
  isLight: true,
  label: 'text-slate-800 font-medium text-sm',
  buttonDisabled: 'bg-slate-400 cursor-not-allowed',
  title: 'text-slate-900',
  subtitle: 'text-slate-500',
  footer: 'text-slate-400',
  alert: 'bg-red-50 border-red-200 text-red-700',
  logoText: 'text-[#4063ca]',
  siteLink: 'border-[#4063ca]/20 bg-[#4063ca]/5 text-[#4063ca] hover:bg-[#4063ca]/10',
} satisfies Partial<ThemeTokens>

export const THEMES: Record<LoginVariantId, ThemeTokens> = {
  1: {
    ...lightBase,
    page: 'bg-white text-slate-900',
    input: lightInput,
    button: 'bg-[#4063ca] hover:bg-[#3B5DE7] text-white shadow-sm',
  },
  2: {
    ...darkBase,
    page: 'bg-[#060b18] text-slate-100',
    input: darkInput,
    button: 'bg-gradient-to-r from-[#4063ca] to-cyan-500 hover:opacity-95 text-white shadow-lg shadow-cyan-500/20',
    siteLink: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20',
    formCard: 'rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 sm:p-8 shadow-[0_0_60px_rgba(64,99,202,0.15)]',
  },
  3: {
    ...darkBase,
    page: 'relative bg-[#0e0d0b] text-white overflow-hidden',
    input:
      'pl-10 h-[46px] bg-white/10 border-white/15 text-white placeholder:text-slate-400 rounded-xl focus:border-[#4063ca] focus-visible:ring-[#4063ca]/30',
    button: 'bg-[#4063ca] hover:bg-[#3B5DE7] text-white shadow-[0_0_24px_rgba(64,99,202,0.45)]',
    siteLink: 'border-white/20 bg-white/10 text-white hover:bg-white/15',
    formCard: 'rounded-3xl border border-white/20 bg-white/10 backdrop-blur-2xl p-8 shadow-2xl',
  },
  4: {
    ...darkBase,
    page: 'login-aurora-bg text-white overflow-hidden',
    input: darkInput,
    button: 'bg-gradient-to-r from-[#4063ca] to-indigo-400 text-white hover:opacity-90',
    formCard: 'rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl p-8',
  },
  5: {
    ...darkBase,
    page: 'login-horizon-bg text-white overflow-hidden',
    input: darkInput,
    button: 'bg-gradient-to-t from-[#4063ca] to-[#5b7ad6] text-white hover:opacity-90',
    formCard: 'rounded-2xl bg-[#0e0d0b]/85 backdrop-blur border border-white/10 p-8',
  },
  6: {
    ...darkBase,
    page: 'login-v26-flow text-white overflow-hidden',
    input: darkInput,
    button: 'login-v26-btn text-white font-semibold',
    formCard: 'login-v26-card relative z-10 rounded-2xl p-4 sm:p-5',
  },
  7: {
    ...darkBase,
    page: 'login-v28-dark text-white overflow-hidden',
    input: darkInput,
    button: 'login-v28-btn text-white font-medium',
    formCard: 'login-v28-card rounded-2xl p-4 sm:p-5 relative z-10',
  },
  8: {
    ...darkBase,
    page: 'login-v30-master bg-black text-white overflow-hidden',
    input: darkInput,
    button: 'login-v30-btn text-white font-bold tracking-wide',
    formCard: 'login-v30-card relative z-10 rounded-2xl p-4 sm:p-5',
  },
  9: {
    ...darkBase,
    page: 'login-v31-spotlight text-white overflow-hidden',
    input: darkInput,
    button: 'login-v31-btn text-white font-semibold',
    formCard: 'login-v31-card rounded-2xl p-4 sm:p-5 relative z-10',
  },
  10: {
    ...darkBase,
    page: 'login-v33-ripple text-white overflow-hidden',
    input: darkInput,
    button: 'login-v33-btn text-white font-semibold',
    formCard: 'login-v33-card rounded-2xl p-4 sm:p-5 relative z-10',
  },
  11: {
    ...darkBase,
    page: 'login-v35-aurora text-white overflow-hidden',
    input: darkInput,
    button: 'login-v35-btn text-white font-bold tracking-wide',
    formCard: 'login-v35-card rounded-2xl p-4 sm:p-5 relative z-10',
  },
  12: {
    ...darkBase,
    page: 'login-v37-comet text-white overflow-hidden',
    input: darkInput,
    button: 'login-v37-btn text-white font-semibold',
    formCard: 'login-v37-card rounded-2xl p-4 sm:p-5 relative z-10',
  },
  ...Object.fromEntries(
    Array.from({ length: 3 }, (_, i) => {
      const id = i + 13
      const btnVariants = [
        'login-fusion-btn login-fusion-btn-a',
        'login-fusion-btn login-fusion-btn-b',
        'login-fusion-btn login-fusion-btn-c',
      ]
      return [
        id,
        {
          ...darkBase,
          page: `login-fusion-${id} text-white overflow-hidden`,
          input: darkInput,
          button: `${btnVariants[i % 3]} text-white font-semibold`,
          formCard: 'login-fusion-card rounded-2xl p-4 sm:p-5 relative z-10',
        },
      ]
    }),
  ) as Record<number, ThemeTokens>,
}
