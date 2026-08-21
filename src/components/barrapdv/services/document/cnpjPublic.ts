import { isValidCnpj, onlyDigits } from './documentValidator'

export type CnpjLookupResult = {
  cnpj: string
  /** Nome comercial ou razão social (compatível com o PDV). */
  name: string
  razaoSocial: string
  fantasia: string
  address: string
  number: string
  neighborhood: string
  city: string
  uf: string
  cep: string
  stateRegistration: string
  phone: string
  email: string
  complemento: string
}

type IeEntry = { ie: string; uf: string; ativo: boolean }

/**
 * Consulta CNPJ — mesmo molde do AppSiTef (publica.cnpj.ws).
 * Prefere a ponte local (sem CORS); fallback no proxy do Vite em dev.
 */
export async function consultarCnpj(cnpj: string): Promise<CnpjLookupResult> {
  const digits = onlyDigits(cnpj)
  if (digits.length !== 14) {
    throw new Error('Informe um CNPJ válido com 14 dígitos.')
  }
  if (!isValidCnpj(digits)) {
    throw new Error('CNPJ inválido.')
  }

  const urls = [
    `http://127.0.0.1:39100/api/cnpj/${digits}`,
    `/api/cnpj/${digits}`,
  ]

  let lastError: Error | null = null
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      if (response.status === 404) throw new Error('CNPJ não encontrado.')
      if (response.status === 429) {
        throw new Error('Limite de consultas atingido. Aguarde e tente novamente.')
      }
      if (!response.ok) {
        let detail = `Erro ao consultar CNPJ (HTTP ${response.status}).`
        try {
          const errBody = (await response.json()) as { error?: string }
          if (errBody.error) detail = errBody.error
        } catch {
          // ignore
        }
        throw new Error(detail)
      }
      const json = (await response.json()) as Record<string, unknown>
      if (json && typeof json === 'object' && typeof json.error === 'string') {
        throw new Error(json.error)
      }
      // Ponte pode embrulhar em { ok, data }
      const payload =
        json && typeof json === 'object' && 'data' in json && json.data
          ? (json.data as Record<string, unknown>)
          : json
      return parseCnpjResponse(digits, payload)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      // tenta próxima URL só em falha de rede / bridge offline
      if (
        lastError.message.includes('não encontrado') ||
        lastError.message.includes('Limite') ||
        lastError.message.includes('inválido')
      ) {
        throw lastError
      }
    }
  }

  throw lastError ?? new Error('Não foi possível consultar o CNPJ.')
}

function parseCnpjResponse(
  cnpj: string,
  json: Record<string, unknown>,
): CnpjLookupResult {
  const estabelecimento =
    (json.estabelecimento as Record<string, unknown> | null | undefined) ?? null
  const razaoSocial = String(json.razao_social ?? '').trim()
  const nomeFantasia = String(estabelecimento?.nome_fantasia ?? '').trim()
  const estado = (estabelecimento?.estado as Record<string, unknown> | null) ?? null
  const cidadeObj = (estabelecimento?.cidade as Record<string, unknown> | null) ?? null
  const ufSede = String(estado?.sigla ?? '').trim()
  const cidade = String(cidadeObj?.nome ?? '').trim()

  const tipoLogradouro = String(estabelecimento?.tipo_logradouro ?? '').trim()
  const logradouro = String(estabelecimento?.logradouro ?? '').trim()
  const address = [tipoLogradouro, logradouro].filter(Boolean).join(' ')

  const { ie, uf: ufIe } = pickInscricaoEstadual(
    estabelecimento?.inscricoes_estaduais,
    ufSede,
  )

  const telefone1 = String(estabelecimento?.ddd1 ?? '').trim()
  const telefone2 = String(estabelecimento?.telefone1 ?? '').trim()
  const phone =
    telefone1 && telefone2
      ? `(${telefone1}) ${telefone2}`
      : [telefone1, telefone2].filter(Boolean).join(' ')

  const cepRaw = onlyDigits(String(estabelecimento?.cep ?? ''))
  const cep =
    cepRaw.length === 8 ? `${cepRaw.slice(0, 5)}-${cepRaw.slice(5)}` : cepRaw

  return {
    cnpj,
    name: nomeFantasia || razaoSocial,
    razaoSocial,
    fantasia: nomeFantasia,
    address,
    number: String(estabelecimento?.numero ?? '').trim(),
    neighborhood: String(estabelecimento?.bairro ?? '').trim(),
    city: cidade,
    uf: ufIe || ufSede,
    cep,
    stateRegistration: ie,
    phone,
    email: String(estabelecimento?.email ?? '').trim(),
    complemento: String(estabelecimento?.complemento ?? '').trim(),
  }
}

function pickInscricaoEstadual(
  inscricoes: unknown,
  ufPreferida: string,
): { ie: string; uf: string } {
  if (!Array.isArray(inscricoes) || inscricoes.length === 0) {
    return { ie: '', uf: '' }
  }

  const entries: IeEntry[] = []
  for (const item of inscricoes) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const ie = String(row.inscricao_estadual ?? '').trim()
    if (!ie) continue
    const estado = (row.estado as Record<string, unknown> | null) ?? null
    const uf = String(estado?.sigla ?? '').trim()
    const ativo = row.ativo !== false
    entries.push({ ie, uf, ativo })
  }

  const pool = entries.filter((e) => e.ativo)
  const list = pool.length ? pool : entries
  if (ufPreferida) {
    const match = list.find((e) => e.uf.toUpperCase() === ufPreferida.toUpperCase())
    if (match) return { ie: match.ie, uf: match.uf }
  }
  const first = list[0]
  return first ? { ie: first.ie, uf: first.uf } : { ie: '', uf: '' }
}
