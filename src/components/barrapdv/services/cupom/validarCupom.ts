import { onlyDigits } from '../document/documentValidator'
import { CUPOM_CONFIG } from './config'

export type CupomTipoDesconto = 'percentual' | 'valor' | 'valor_unitario'

export type ValidarCupomResult = {
  ok: boolean
  mensagem: string
  valor: number
  tipo: CupomTipoDesconto | string
  produto: string
}

type ApiData = {
  valor_unitario?: number
  tipo_cupom?: string
  tipo_produto?: string | number
}

type ApiResponse = {
  sucesso?: boolean
  data?: ApiData
  mensagem?: string
  message?: string
  error?: string
}

async function postValidar(url: string, body: string): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: CUPOM_CONFIG.authorization,
    },
    body,
  })
}

function cnpjParaApi(): string {
  return onlyDigits(CUPOM_CONFIG.cnpjPostoFallback) || '93013845000100'
}

/**
 * Equivalente a Tfrm_fechavenda.ValidarCupom (HTTP Supabase).
 * Sempre envia codigo_gerado + cnpj_posto (obrigatórios na API).
 */
export async function validarCupom(codigo: string | number): Promise<ValidarCupomResult> {
  const codigoGerado = String(codigo).trim()
  if (!codigoGerado) {
    return {
      ok: false,
      mensagem: 'CODIGO NÃO INFORMADO',
      valor: 0,
      tipo: '',
      produto: '',
    }
  }

  const payload = JSON.stringify({
    codigo_gerado: codigoGerado,
    cnpj_posto: cnpjParaApi(),
  })

  const urls = [CUPOM_CONFIG.proxyUrl, CUPOM_CONFIG.validarUrl]
  let lastError = 'Falha ao consultar cupom'

  for (const url of urls) {
    try {
      const res = await postValidar(url, payload)
      const text = await res.text()
      let json: ApiResponse = {}
      try {
        json = text ? (JSON.parse(text) as ApiResponse) : {}
      } catch {
        json = {}
      }

      if (res.status === 200) {
        if (json.data?.tipo_cupom || (json.sucesso && json.data)) {
          return {
            ok: true,
            mensagem: json.sucesso
              ? 'Cupom válido!'
              : json.mensagem || json.message || 'Cupom válido!',
            valor: Number(json.data?.valor_unitario) || 0,
            tipo: String(json.data?.tipo_cupom || ''),
            produto: String(json.data?.tipo_produto ?? ''),
          }
        }

        return {
          ok: false,
          mensagem:
            json.mensagem ||
            json.message ||
            json.error ||
            'Cupom inválido ou já utilizado',
          valor: 0,
          tipo: '',
          produto: '',
        }
      }

      lastError = `Erro HTTP: ${res.status}${text ? `\n${text}` : ''}`
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
  }

  return {
    ok: false,
    mensagem: lastError,
    valor: 0,
    tipo: '',
    produto: '',
  }
}
