'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { LogOut, Loader2 } from 'lucide-react'

export function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    setIsLoading(true)
    const supabase = createClient()
    
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <Button
      onClick={handleLogout}
      variant="outline"
      size="sm"
      disabled={isLoading}
      className="border-border text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          <LogOut className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Cerrar Sesión</span>
        </>
      )}
    </Button>
  )
}
