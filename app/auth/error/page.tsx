import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import { BRAND_NAME } from '@/lib/brand'

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-destructive/10 border border-destructive/30">
            <AlertTriangle className="w-12 h-12 text-destructive" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-foreground mb-4">
          Error de Autenticación
        </h1>
        
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Ha ocurrido un error durante el proceso de autenticación. Por favor, intente nuevamente o contacte a soporte si el problema persiste.
        </p>

        <div className="flex flex-col gap-3">
          <Button asChild className="w-full h-12 bg-primary text-primary-foreground hover:bg-gold-light font-semibold">
            <Link href="/auth/login">Volver a Iniciar Sesión</Link>
          </Button>
          
          <Button asChild variant="outline" className="w-full h-12 border-border text-foreground hover:bg-secondary">
            <Link href="/">Ir al Inicio</Link>
          </Button>
        </div>

        <div className="mt-8 pt-8 border-t border-border">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Image src="/logo-upcrop.png" alt={BRAND_NAME} width={20} height={20} className="rounded" />
            <span className="text-sm font-medium text-foreground">
              Up <span className="text-primary">Crop</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
