import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** Plan de cosecha vive dentro de Estimación de cosecha (pestaña). */
export default function PlanDeCosechaPage() {
  redirect('/dashboard/estimacion-cosecha?tab=plan')
}
