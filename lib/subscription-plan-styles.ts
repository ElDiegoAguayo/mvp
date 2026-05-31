import type { ServicePlanId } from '@/lib/subscription-plans'

export type PlanVisualTier = 'bronze' | 'silver' | 'premium'

export const PLAN_VISUAL_TIER: Record<ServicePlanId, PlanVisualTier> = {
  esencial: 'bronze',
  enterprise: 'silver',
  business: 'premium',
}

export function getPlanVisualTier(planId: ServicePlanId): PlanVisualTier {
  return PLAN_VISUAL_TIER[planId]
}

export function getPlanCardStyles(planId: ServicePlanId, opts?: { isCurrent?: boolean }) {
  const tier = getPlanVisualTier(planId)
  const isCurrent = opts?.isCurrent ?? false

  const base = {
    article: '',
    glow: '',
    shine: true,
    topBadge: null as 'leader' | 'premium' | null,
    leaderBadge: '',
    premiumBadge: '',
    iconWrap: '',
    title: '',
    description: '',
    price: '',
    priceSuffix: '',
    priceLabel: '',
    priceBox: '',
    featureCheck: '',
    featureText: '',
    currentBadge: '',
    footnote: '',
  }

  if (tier === 'bronze') {
    return {
      ...base,
      article: cn(
        'border-2 border-[#a0622a]/70',
        'bg-[linear-gradient(145deg,#fce8d4_0%,#e8b88a_28%,#d4956a_55%,#c97840_82%,#b87333_100%)]',
        'shadow-[0_8px_28px_-6px_rgba(101,52,14,0.45),inset_0_1px_0_rgba(255,255,255,0.5)]',
        'hover:shadow-[0_12px_32px_-6px_rgba(101,52,14,0.5),inset_0_1px_0_rgba(255,255,255,0.55)]',
        isCurrent && 'ring-2 ring-[#b87333]/60 ring-offset-2 ring-offset-background',
      ),
      glow: 'absolute -inset-1 rounded-2xl bg-gradient-to-b from-[#cd7f32]/50 via-[#b87333]/20 to-[#8b4513]/30 opacity-90 -z-10 blur-md',
      iconWrap:
        'border border-[#6b3a12]/80 bg-[linear-gradient(145deg,#f0c898_0%,#cd7f32_35%,#b87333_65%,#7a4518_100%)] text-[#fffaf5] shadow-[0_4px_14px_rgba(101,52,14,0.45),inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-2px_0_rgba(0,0,0,0.25)]',
      title: 'text-[#3d2208] drop-shadow-[0_1px_0_rgba(255,255,255,0.35)]',
      description: 'text-[#5c3412]/90',
      price:
        'bg-[linear-gradient(180deg,#3d2208_0%,#6b3a12_45%,#3d2208_100%)] bg-clip-text text-transparent drop-shadow-[0_1px_0_rgba(255,255,255,0.4)]',
      priceSuffix: 'text-[#6b4423]/85',
      priceLabel: 'text-[#6b4423]/85',
      priceBox:
        'border border-[#b87333]/50 bg-[linear-gradient(160deg,rgba(255,252,248,0.92)_0%,rgba(240,220,196,0.75)_100%)] shadow-[inset_0_2px_0_rgba(255,255,255,0.65),inset_0_-1px_0_rgba(139,69,19,0.15)]',
      featureCheck:
        'bg-[linear-gradient(145deg,#f5d4b0,#cd7f32)] text-[#3d2208] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] ring-1 ring-[#a0622a]/40',
      featureText: 'text-[#3d2208]/92',
      currentBadge: 'border-[#b87333]/50 bg-[#f0dcc4]/90 text-[#5c3a1e]',
    }
  }

  if (tier === 'silver') {
    return {
      ...base,
      article: cn(
        'border-2 border-zinc-200/95',
        'bg-[linear-gradient(152deg,#ffffff_0%,#f8f8f9_18%,#ececee_42%,#d8d8dc_68%,#c4c4c9_88%,#b0b0b8_100%)]',
        'shadow-[0_14px_40px_-10px_rgba(82,82,91,0.55),inset_0_1px_0_rgba(255,255,255,1)]',
        'hover:shadow-[0_18px_44px_-10px_rgba(82,82,91,0.6),inset_0_1px_0_rgba(255,255,255,1)]',
        'lg:scale-[1.05] lg:-my-1.5 lg:z-10',
        isCurrent && 'ring-2 ring-zinc-300 ring-offset-2 ring-offset-background',
      ),
      glow: 'absolute -inset-1.5 rounded-2xl bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.85)_0%,rgba(212,212,216,0.4)_45%,rgba(113,113,122,0.3)_100%)] opacity-100 -z-10 blur-lg plan-silver-glow',
      topBadge: 'leader' as const,
      leaderBadge:
        'border border-white/80 bg-[linear-gradient(180deg,#ffffff_0%,#e4e4e7_35%,#a1a1aa_75%,#71717a_100%)] text-zinc-900 shadow-[0_4px_14px_rgba(82,82,91,0.4),inset_0_1px_0_rgba(255,255,255,1),inset_0_-1px_0_rgba(113,113,122,0.25)] hover:opacity-100',
      iconWrap:
        'border border-white/70 bg-[linear-gradient(155deg,#ffffff_0%,#e4e4e7_30%,#a1a1aa_62%,#52525b_100%)] text-white shadow-[0_6px_18px_rgba(82,82,91,0.45),inset_0_2px_0_rgba(255,255,255,0.95),inset_0_-3px_0_rgba(63,63,70,0.35)]',
      title: 'text-zinc-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.95)]',
      description: 'text-zinc-600/95',
      price:
        'bg-[linear-gradient(180deg,#18181b_0%,#52525b_28%,#d4d4d8_48%,#71717a_62%,#27272a_100%)] bg-clip-text text-transparent drop-shadow-[0_1px_0_rgba(255,255,255,0.75)]',
      priceSuffix: 'text-zinc-500/90',
      priceLabel: 'text-zinc-500/90',
      priceBox:
        'border border-white/60 bg-[linear-gradient(165deg,rgba(255,255,255,0.98)_0%,rgba(244,244,245,0.92)_45%,rgba(228,228,231,0.88)_100%)] shadow-[inset_0_2px_0_rgba(255,255,255,1),inset_0_-2px_0_rgba(161,161,170,0.2)]',
      featureCheck:
        'bg-[linear-gradient(155deg,#ffffff,#d4d4d8_55%,#a1a1aa)] text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,1),inset_0_-1px_0_rgba(113,113,122,0.2)] ring-1 ring-zinc-300/70',
      featureText: 'text-zinc-900/90',
      currentBadge: 'border-zinc-200/80 bg-white/90 text-zinc-800 shadow-sm',
    }
  }

  return {
    ...base,
    article: cn(
      'border-2 border-amber-400/55',
      'bg-[linear-gradient(145deg,#0f172a_0%,#1a1510_35%,#1e1b14_55%,#0c0a09_100%)]',
      'shadow-[0_14px_44px_-8px_rgba(180,83,9,0.45),0_0_0_1px_rgba(251,191,36,0.12),inset_0_1px_0_rgba(251,191,36,0.35)]',
      'hover:shadow-[0_18px_48px_-8px_rgba(180,83,9,0.55),0_0_24px_rgba(251,191,36,0.15),inset_0_1px_0_rgba(251,191,36,0.45)]',
      'lg:scale-[1.02]',
      isCurrent && 'ring-2 ring-amber-400/70 ring-offset-2 ring-offset-background',
    ),
    glow: 'absolute -inset-1.5 rounded-2xl bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.35)_0%,rgba(180,83,9,0.15)_50%,transparent_75%)] opacity-100 -z-10 blur-lg plan-premium-glow',
    topBadge: 'premium' as const,
    premiumBadge:
      'border border-amber-300/60 bg-[linear-gradient(180deg,#fde68a_0%,#f59e0b_45%,#d97706_100%)] text-amber-950 shadow-[0_4px_14px_rgba(180,83,9,0.45),inset_0_1px_0_rgba(255,255,255,0.55)] hover:opacity-100',
    iconWrap:
      'border border-amber-300/60 bg-[linear-gradient(145deg,rgba(253,230,138,0.35)_0%,rgba(251,191,36,0.25)_40%,rgba(120,53,15,0.4)_100%)] text-amber-100 shadow-[0_4px_16px_rgba(251,191,36,0.25),inset_0_1px_0_rgba(253,230,138,0.55),inset_0_-2px_0_rgba(0,0,0,0.35)]',
    title: 'text-amber-50 drop-shadow-[0_1px_0_rgba(251,191,36,0.3)]',
    description: 'text-slate-300',
    price:
      'bg-[linear-gradient(180deg,#fef3c7_0%,#fbbf24_35%,#fde68a_55%,#f59e0b_100%)] bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(251,191,36,0.35)]',
    priceSuffix: 'text-amber-400/85',
    priceLabel: 'text-amber-400/90',
    priceBox:
      'border border-amber-500/40 bg-[linear-gradient(160deg,rgba(251,191,36,0.08)_0%,rgba(0,0,0,0.2)_100%)] shadow-[inset_0_1px_0_rgba(251,191,36,0.2)]',
    featureCheck:
      'bg-[linear-gradient(145deg,rgba(251,191,36,0.25),rgba(180,83,9,0.15))] text-amber-200 ring-1 ring-amber-500/40 shadow-[inset_0_1px_0_rgba(251,191,36,0.3)]',
    featureText: 'text-slate-200',
    currentBadge: 'border-amber-400/45 bg-amber-500/15 text-amber-100',
    footnote: 'text-amber-400/85 border-amber-500/25',
  }
}

export function getContractedPlanCardStyles(planId: ServicePlanId) {
  const tier = getPlanVisualTier(planId)

  if (tier === 'bronze') {
    return {
      card: 'border-2 border-[#a0622a]/60 bg-[linear-gradient(135deg,#fce8d4,#e8b88a,#d4956a)] shadow-[0_6px_20px_-4px_rgba(101,52,14,0.35),inset_0_1px_0_rgba(255,255,255,0.45)]',
      iconWrap:
        'border border-[#6b3a12]/70 bg-[linear-gradient(145deg,#f0c898,#cd7f32,#7a4518)] text-[#fffaf5] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]',
      activeBadge: 'bg-[linear-gradient(180deg,#e8b88a,#b87333,#7a4518)] hover:opacity-95',
      leaderBadge: '',
      title: 'text-[#3d2208]',
      description: 'text-[#5c3412]/90',
      priceBox: 'border-[#b87333]/45 bg-[linear-gradient(160deg,rgba(255,252,248,0.9),rgba(232,184,138,0.6))] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]',
      price: 'bg-[linear-gradient(180deg,#3d2208,#6b3a12,#3d2208)] bg-clip-text text-transparent',
      priceSuffix: 'text-[#6b4423]/80',
      label: 'text-[#6b4423]/85',
    }
  }

  if (tier === 'silver') {
    return {
      card: 'border-2 border-zinc-200/90 bg-[linear-gradient(140deg,#ffffff,#ececee,#d4d4d8)] shadow-[0_10px_28px_-8px_rgba(82,82,91,0.4),inset_0_1px_0_rgba(255,255,255,1)]',
      iconWrap:
        'border border-white/70 bg-[linear-gradient(155deg,#ffffff,#e4e4e7,#52525b)] text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.9),inset_0_-2px_0_rgba(63,63,70,0.3)]',
      activeBadge:
        'bg-[linear-gradient(180deg,#ffffff,#a1a1aa,#52525b)] text-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] hover:opacity-95',
      leaderBadge:
        'border-white/70 bg-[linear-gradient(180deg,#ffffff,#d4d4d8,#a1a1aa)] text-zinc-900 shadow-sm',
      title: 'text-zinc-950',
      description: 'text-zinc-600/95',
      priceBox:
        'border-white/60 bg-[linear-gradient(165deg,rgba(255,255,255,0.98),rgba(228,228,231,0.9))] shadow-[inset_0_1px_0_rgba(255,255,255,1)]',
      price: 'bg-[linear-gradient(180deg,#18181b,#52525b,#d4d4d8,#27272a)] bg-clip-text text-transparent',
      priceSuffix: 'text-zinc-500/90',
      label: 'text-zinc-500/90',
    }
  }

  return {
    card: 'border-2 border-amber-400/50 bg-[linear-gradient(135deg,#0f172a,#1a1510,#0c0a09)] shadow-[0_12px_36px_-8px_rgba(180,83,9,0.4),0_0_20px_rgba(251,191,36,0.08),inset_0_1px_0_rgba(251,191,36,0.25)]',
    iconWrap:
      'border border-amber-400/50 bg-[linear-gradient(145deg,rgba(251,191,36,0.3),rgba(120,53,15,0.35))] text-amber-200',
    activeBadge:
      'bg-[linear-gradient(180deg,#fde68a,#f59e0b,#d97706)] text-amber-950 hover:opacity-95',
    leaderBadge: '',
    title: 'text-amber-50',
    description: 'text-slate-300',
    priceBox: 'border-amber-500/35 bg-amber-500/5 shadow-[inset_0_1px_0_rgba(251,191,36,0.15)]',
    price: 'bg-[linear-gradient(180deg,#fef3c7,#fbbf24,#f59e0b)] bg-clip-text text-transparent',
    priceSuffix: 'text-amber-400/85',
    label: 'text-amber-400/90',
  }
}

function cn(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(' ')
}
