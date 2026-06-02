import { redirect } from 'next/navigation'
import { PROVEEDORES_DEFAULT_HREF } from '@/lib/dashboard/proveedores-module'

export default function ProveedoresIndexPage() {
  redirect(PROVEEDORES_DEFAULT_HREF)
}
