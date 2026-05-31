'use client'

import { TechAssistanceManager } from '@/components/dashboard/asistencia-tecnica/tech-assistance-manager'

interface TechAssistanceClientViewProps {
  canApproveProformas: boolean
}

export function TechAssistanceClientView({ canApproveProformas }: TechAssistanceClientViewProps) {
  return <TechAssistanceManager mode="client" canApproveProformas={canApproveProformas} />
}
