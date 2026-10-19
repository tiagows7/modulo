import { assinarNFeXml } from './assinatura.mjs'
import { autorizarNfce } from './autorizar.mjs'
import { buildInfNFeXml } from './xmlNfce.mjs'

function pad(n, size) {
  return String(n).padStart(size, '0')
}

function nowParts(d = new Date()) {
  return {
    emissao: d.toLocaleDateString('pt-BR'),
    hora: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    issuedAt: d.toISOString(),
  }
}

/**
 * Transmissor SEFAZ real (NFC-e) via certificado A1.
 *
 * @param {{ pfx: Buffer, passphrase: string }} cert
 * @returns {import('../types').FiscalTransmitter}
 */
export function createSefazTransmitter(cert) {
  if (!cert?.pfx?.length) {
    throw new Error('Certificado A1 (PFX) é obrigatório para transmissão SEFAZ.')
  }
  if (!cert.passphrase) {
    throw new Error('Senha do certificado A1 é obrigatória.')
  }

  return {
    async transmit(input) {
      const built = buildInfNFeXml(input)
      let nfeAssinado = assinarNFeXml(
        built.xmlInfNFe,
        cert.pfx,
        cert.passphrase,
      )
      // infNFeSupl fica fora do nó assinado
      if (built.xmlInfNFeSupl && !nfeAssinado.includes('<infNFeSupl')) {
        if (nfeAssinado.includes('</NFe>')) {
          nfeAssinado = nfeAssinado.replace(
            '</NFe>',
            `${built.xmlInfNFeSupl}</NFe>`,
          )
        } else {
          nfeAssinado = `${nfeAssinado}${built.xmlInfNFeSupl}`
        }
      }

      const tipo = built.tipo === 'NF-e' ? 'NF-e' : 'NFC-e'
      const modelo = tipo === 'NF-e' ? '55' : '65'
      const ret = await autorizarNfce({
        nfeXmlAssinado: nfeAssinado,
        uf: built.uf,
        tpAmb: built.tpAmb,
        pfx: cert.pfx,
        passphrase: cert.passphrase,
        idLote: built.numero,
        modelo,
      })

      const { emissao, hora, issuedAt } = nowParts(built.dhEmi)
      const cliente =
        input.buyer?.name?.trim() ||
        input.buyer?.customerCode?.trim() ||
        'Consumidor final'

      const status = ret.authorized
        ? 'authorized'
        : ret.denied
          ? 'denied'
          : 'error'

      const document = {
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        tipo,
        modelo,
        numero: built.numero,
        serie: built.serie,
        chave: ret.chave || built.chave,
        protocolo: ret.protocolo,
        ambiente: built.tpAmb,
        status,
        valor: built.total,
        cliente,
        buyerDocument: input.buyer?.document || undefined,
        buyerEmail: input.buyer?.email || undefined,
        saleRef: input.saleRef,
        issuedAt,
        emissao,
        hora,
        items: (input.items || []).map((i) => ({ ...i })),
        payments: (input.payments || []).map((p) => ({ ...p })),
        xml: ret.xml,
        digVal: ret.digVal,
        error: status === 'authorized' ? null : `${ret.cStat} — ${ret.xMotivo}`,
      }

      if (status !== 'authorized') {
        const err = new Error(
          `SEFAZ recusou a ${tipo} (${ret.cStat}): ${ret.xMotivo || 'sem motivo'}` +
            ` [cUF=${built.cUF} cMunFG=${built.cMun}${built.emitiuIbscbs ? ' IBSCBS=sim' : ''}]`,
        )
        err.document = document
        err.sefaz = ret
        throw err
      }

      return {
        document,
        message: `${tipo} ${pad(built.numero, 6)} autorizada pela SEFAZ (prot. ${ret.protocolo || '—'}).`,
      }
    },
  }
}
