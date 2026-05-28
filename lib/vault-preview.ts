export type VaultPreviewKind = 'pdf' | 'image' | 'excel' | 'word' | 'unsupported'

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'])
const EXCEL_EXT = new Set(['xls', 'xlsx', 'csv'])
const WORD_EXT = new Set(['doc', 'docx'])

export function resolveVaultPreviewKind(type: string, fileName: string): VaultPreviewKind {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const normalizedType = type.toLowerCase()

  if (normalizedType === 'pdf' || ext === 'pdf') return 'pdf'
  if (normalizedType === 'image' || IMAGE_EXT.has(ext)) return 'image'
  if (normalizedType === 'excel' || EXCEL_EXT.has(ext)) return 'excel'
  if (normalizedType === 'word' || WORD_EXT.has(ext)) return 'word'
  return 'unsupported'
}

export function isVaultPreviewable(type: string, fileName: string): boolean {
  return resolveVaultPreviewKind(type, fileName) !== 'unsupported'
}

export function vaultPreviewKindLabel(kind: VaultPreviewKind): string {
  switch (kind) {
    case 'pdf': return 'Documento PDF'
    case 'image': return 'Imagen'
    case 'excel': return 'Hoja de cálculo'
    case 'word': return 'Documento Word'
    default: return 'Archivo'
  }
}

export function inferVaultFileType(fileName: string, mimeType?: string): 'pdf' | 'excel' | 'image' | 'word' {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'excel'
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image'
  if (['doc', 'docx'].includes(ext)) return 'word'
  if (ext === 'pdf') return 'pdf'
  if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel') || mimeType?.includes('csv')) return 'excel'
  if (mimeType?.includes('word')) return 'word'
  if (mimeType?.startsWith('image/')) return 'image'
  return 'pdf'
}
