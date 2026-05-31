'use client'

import {
  TechAssistanceManager,
  type TechAssistanceClientOption,
} from '@/components/dashboard/asistencia-tecnica/tech-assistance-manager'

interface TechAssistanceAdminViewProps {
  clients?: TechAssistanceClientOption[]
}

export function TechAssistanceAdminView({ clients = [] }: TechAssistanceAdminViewProps) {
  return <TechAssistanceManager mode="admin" clients={clients} />
}
