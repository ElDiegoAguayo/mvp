/** SHA-256 hex digest of file bytes (browser). */
export async function hashFileContent(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function findDuplicateQuotationByFile(
  file: File,
  fileHash: string,
  quotations: Array<{
    id: string
    reference: string
    file_name: string | null
    file_size: number
    file_content_hash: string | null
  }>,
) {
  const byHash = quotations.find(q => q.file_content_hash === fileHash)
  if (byHash) return byHash

  return (
    quotations.find(
      q =>
        !q.file_content_hash &&
        q.file_name === file.name &&
        q.file_size === file.size &&
        q.file_size > 0,
    ) ?? null
  )
}
