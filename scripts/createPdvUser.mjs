import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envPath = path.join(root, '.env.local')
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    }),
)

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Operador digita "pdv"; Auth exige >= 6 chars — senha real no Supabase. */
const email = 'pdv@modulo.com'
const authPassword = 'pdvpdv'

const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
if (listed.error) {
  console.error(listed.error.message)
  process.exit(1)
}

const existing = (listed.data.users || []).find(
  (u) => (u.email || '').toLowerCase() === email,
)

if (existing) {
  const { error } = await supabase.auth.admin.updateUserById(existing.id, {
    password: authPassword,
    email_confirm: true,
    user_metadata: {
      ...(existing.user_metadata || {}),
      role: 'pdv',
      name: 'Operador PDV',
    },
  })
  if (error) {
    console.error(error.message)
    process.exit(1)
  }
  console.log('PDV user updated:', email)
} else {
  const { error } = await supabase.auth.admin.createUser({
    email,
    password: authPassword,
    email_confirm: true,
    user_metadata: { role: 'pdv', name: 'Operador PDV' },
  })
  if (error) {
    console.error(error.message)
    process.exit(1)
  }
  console.log('PDV user created:', email)
}

console.log('Tela de login: usuario pdv / senha pdv → /pdv#/venda')
