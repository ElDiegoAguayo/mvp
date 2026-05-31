'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, FileText, FileSpreadsheet, Image as ImageIcon, Download, AlertCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SharedLink {
  code: string
  bucket: string
  storage_path: string
  file_name: string
  expires_at: string
}

function getFileType(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'excel'
  return 'pdf'
}

function formatExpiry(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function SharePage() {
  const { code } = useParams<{ code: string }>()
  const [status, setStatus] = useState<'loading' | 'ready' | 'expired' | 'error'>('loading')
  const [link, setLink] = useState<SharedLink | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    const supabase = createClient()

    async function load() {
      const { data, error } = await supabase
        .from('shared_links')
        .select('code, bucket, storage_path, file_name, expires_at')
        .eq('code', code)
        .single()

      if (error || !data) { setStatus('error'); return }

      if (new Date(data.expires_at) < new Date()) { setStatus('expired'); return }

      setLink(data)

      // Generate a fresh signed URL (short-lived, just for this session)
      const { data: signed, error: signErr } = await supabase.storage
        .from(data.bucket)
        .createSignedUrl(data.storage_path, 60 * 60) // 1h for viewing

      if (signErr || !signed) { setStatus('error'); return }

      setFileUrl(signed.signedUrl)
      setStatus('ready')
    }

    load()
  }, [code])

  const fileType = link ? getFileType(link.file_name) : 'pdf'

  const FileIcon = fileType === 'image' ? ImageIcon : fileType === 'excel' ? FileSpreadsheet : FileText
  const iconColor = fileType === 'image' ? 'text-blue-500' : fileType === 'excel' ? 'text-green-500' : 'text-red-500'
  const iconBg   = fileType === 'image' ? 'bg-blue-500/10' : fileType === 'excel' ? 'bg-green-500/10' : 'bg-red-500/10'

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start pt-12 px-4">
      {/* Brand bar */}
      <div className="mb-8 flex items-center gap-2">
        <span className="text-2xl font-bold tracking-tight text-foreground">
          Up <span className="text-primary">Crop</span>
        </span>
        <span className="text-muted-foreground text-sm">/ Bóveda Documental</span>
      </div>

      <div className="w-full max-w-2xl">
        {/* Loading */}
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p>Verificando link…</p>
          </div>
        )}

        {/* Expired */}
        {status === 'expired' && (
          <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
              <Clock className="w-7 h-7 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold">Link expirado</h2>
            <p className="text-muted-foreground text-sm">Este link de compartir ya no es válido. Solicita uno nuevo al remitente.</p>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7 text-destructive" />
            </div>
            <h2 className="text-xl font-bold">Link no encontrado</h2>
            <p className="text-muted-foreground text-sm">Este link no existe o fue eliminado.</p>
          </div>
        )}

        {/* Ready */}
        {status === 'ready' && link && fileUrl && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            {/* File header */}
            <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                <FileIcon className={`w-5 h-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{link.file_name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Válido hasta {formatExpiry(link.expires_at)}</p>
                </div>
              </div>
              <Button size="sm" asChild className="gap-1.5 flex-shrink-0">
                <a href={fileUrl} download={link.file_name} target="_blank" rel="noreferrer">
                  <Download className="w-3.5 h-3.5" />
                  Descargar
                </a>
              </Button>
            </div>

            {/* Preview */}
            <div className="bg-muted/30" style={{ minHeight: '70vh' }}>
              {fileType === 'image' && (
                <div className="flex items-center justify-center p-8" style={{ minHeight: '70vh' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fileUrl} alt={link.file_name} className="max-w-full max-h-full object-contain rounded-lg shadow" />
                </div>
              )}
              {fileType === 'pdf' && (
                <iframe
                  title={link.file_name}
                  src={fileUrl}
                  className="w-full"
                  style={{ height: '70vh', border: 'none' }}
                />
              )}
              {fileType === 'excel' && (
                <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
                  <FileSpreadsheet className="w-12 h-12 text-green-500" />
                  <p className="text-sm">Las planillas Excel no pueden previsualizarse en el navegador.</p>
                  <Button asChild>
                    <a href={fileUrl} download={link.file_name}>
                      <Download className="w-4 h-4 mr-2" />
                      Descargar archivo
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
