import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const raw = readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '')
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('=')
  if (eq === -1) continue
  let v = t.slice(eq + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  process.env[t.slice(0, eq).trim()] = v
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const fixes = [
  { from: 'Creck List', to: 'Check List' },
  { from: 'Check list', to: 'Check List' },
]

for (const { from, to } of fixes) {
  const { data, error } = await sb.from('dynamic_charts').update({ name: to }).eq('name', from).select('id, name, user_id')
  if (error) {
    console.error(`Error fixing "${from}":`, error.message)
  } else {
    console.log(`"${from}" -> "${to}":`, data?.length ?? 0, 'chart(s)', data)
  }
}

// Also fix table descriptions if needed
const { data: tables, error: tableErr } = await sb
  .from('dynamic_tables')
  .update({ name: 'Demo — Check List exportación' })
  .eq('name', 'Demo — Check list exportación')
  .select('id, name, user_id')

if (tableErr) console.error('Table fix error:', tableErr.message)
else console.log('Table name fixes:', tables?.length ?? 0, tables)
