import { redirect } from 'next/navigation'
import { FITOSANITARIO_DEFAULT_HREF } from '@/lib/dashboard/fitosanitario-module'

export default function InventarioFitosanitarioIndexPage() {
  redirect(FITOSANITARIO_DEFAULT_HREF)
}
