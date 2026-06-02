import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** Plan de cosecha retirado: redirige a estimación de cosecha. */
export default function PlanDeCosechaPage() {
  redirect('/dashboard/estimacion-cosecha')
}
