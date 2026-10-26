import https from 'node:https'
import { nfceAutorizacaoUrl, nfeAutorizacaoUrl } from './utils.mjs'

function tag(xml, name) {
  const re = new RegExp(
    `<(?:\\w+:)?${name}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`,
    'i',
  )
  const m = re.exec(xml)
  return m ? m[1].trim() : ''
}

function buildSoapAutorizacao(enviNFeXml) {
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xmlns:xsd="http://www.w3.org/2001/XMLSchema" ` +
    `xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap12:Body>` +
    `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">` +
    enviNFeXml +
    `</nfeDadosMsg>` +
    `</soap12:Body>` +
    `</soap12:Envelope>`
  )
}

function mapTlsError(err) {
  const msg = err instanceof Error ? err.message : String(err || '')
  if (/unable to get local issuer certificate|CERT_UNTRUSTED|self[- ]signed/i.test(msg)) {
    return new Error(
      'Falha TLS com a SEFAZ (cadeia de certificado). Tente novamente; se persistir, verifique o .pfx da filial.',
    )
  }
  if (/certificate|SSL|TLS|EPROTO/i.test(msg)) {
    return new Error(`Falha de certificado/TLS na SEFAZ: ${msg}`)
  }
  return err instanceof Error ? err : new Error(msg || 'Falha na comunicação com a SEFAZ.')
}

function httpsPostPfx({ url, body, pfx, passphrase, timeoutMs = 60000 }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    // SEFAZ costuma exigir mTLS com o PFX A1. Com `pfx` no Agent o Node
    // às vezes não resolve a CA do webservice → "unable to get local issuer".
    // Mesmo padrão usado por libs fiscais BR: mTLS do cliente + sem validar CA do host.
    const agent = new https.Agent({
      pfx,
      passphrase,
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2',
    })

    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: 'POST',
        agent,
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          SOAPAction:
            'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote',
          'Content-Length': Buffer.byteLength(body, 'utf8'),
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
        res.on('end', () => {
          agent.destroy()
          const text = Buffer.concat(chunks).toString('utf8')
          if ((res.statusCode ?? 500) >= 400) {
            reject(
              new Error(
                `SEFAZ HTTP ${res.statusCode}: ${text.slice(0, 500) || 'sem corpo'}`,
              ),
            )
            return
          }
          resolve(text)
        })
      },
    )

    req.on('timeout', () => {
      req.destroy(new Error('Tempo esgotado na autorização SEFAZ.'))
    })
    req.on('error', (err) => {
      agent.destroy()
      reject(mapTlsError(err))
    })
    req.write(body, 'utf8')
    req.end()
  })
}

/**
 * Envia NFC-e assinada (lote síncrono idLote) e interpreta o retorno.
 */
export async function autorizarNfce({
  nfeXmlAssinado,
  uf,
  tpAmb,
  pfx,
  passphrase,
  idLote,
  modelo,
}) {
  const lote = String(idLote || Date.now()).slice(-15).padStart(15, '0')
  const enviNFe =
    `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
    `<idLote>${lote}</idLote>` +
    `<indSinc>1</indSinc>` +
    nfeXmlAssinado +
    `</enviNFe>`

  const isNfe = String(modelo) === '55'
  const url = isNfe ? nfeAutorizacaoUrl(uf, tpAmb) : nfceAutorizacaoUrl(uf, tpAmb)
  const soap = buildSoapAutorizacao(enviNFe)
  let responseXml
  try {
    responseXml = await httpsPostPfx({
      url,
      body: soap,
      pfx,
      passphrase,
    })
  } catch (err) {
    throw mapTlsError(err)
  }

  // retEnviNFe (lote) e infProt (nota) têm cStat/xMotivo distintos —
  // preferir sempre o protocolo da NF-e quando existir.
  const infProtMatch = /<(?:\w+:)?infProt\b[\s\S]*?<\/(?:\w+:)?infProt>/i.exec(
    responseXml,
  )
  const infProtXml = infProtMatch ? infProtMatch[0] : ''
  const loteCStat = tag(responseXml, 'cStat')
  const loteMotivo = tag(responseXml, 'xMotivo')
  const protCStat = (infProtXml ? tag(infProtXml, 'cStat') : '') || loteCStat
  const xMotivo =
    (infProtXml ? tag(infProtXml, 'xMotivo') : '') || loteMotivo || ''
  const nProt = tag(infProtXml || responseXml, 'nProt')
  const digVal = tag(infProtXml || responseXml, 'digVal')
  const chNFe = tag(infProtXml || responseXml, 'chNFe')

  const authorized = protCStat === '100' || protCStat === '150'
  const denied = ['110', '301', '302', '303'].includes(String(protCStat))

  // Monta procNFe quando autorizado
  let xmlProc = nfeXmlAssinado
  if (authorized) {
    const protNFeMatch = /<(?:\w+:)?protNFe[\s\S]*?<\/(?:\w+:)?protNFe>/i.exec(
      responseXml,
    )
    const protNFe = protNFeMatch
      ? protNFeMatch[0].replace(/^<\w+:protNFe/, '<protNFe').replace(/<\/\w+:protNFe>/, '</protNFe>')
      : ''
    if (protNFe) {
      xmlProc =
        `<?xml version="1.0" encoding="UTF-8"?>` +
        `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
        nfeXmlAssinado +
        protNFe +
        `</nfeProc>`
    }
  }

  return {
    authorized,
    denied,
    cStat: String(protCStat || cStat || ''),
    xMotivo: xMotivo || '',
    protocolo: nProt || undefined,
    digVal: digVal || undefined,
    chave: chNFe || undefined,
    xml: xmlProc,
    raw: responseXml,
    url,
  }
}
