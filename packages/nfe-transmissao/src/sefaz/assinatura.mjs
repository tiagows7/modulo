import forge from 'node-forge'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { SignedXml } = require('xml-crypto')
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom')

/**
 * Extrai chave privada + certificado (PEM) do PFX A1.
 */
export function extractPfxPem(pfx, passphrase) {
  const binary = forge.util.createBuffer(
    Buffer.isBuffer(pfx) ? pfx.toString('binary') : String(pfx),
  )
  const asn1 = forge.asn1.fromDer(binary)
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, passphrase)

  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] ||
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ||
    []
  const certBags =
    p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ||
    []

  if (!keyBags.length || !keyBags[0].key) {
    throw new Error('Não foi possível ler a chave privada do certificado A1.')
  }
  if (!certBags.length || !certBags[0].cert) {
    throw new Error('Não foi possível ler o certificado A1.')
  }

  // Preferir o certificado de usuário (não a autoridade intermediária)
  let cert = certBags[0].cert
  for (const bag of certBags) {
    if (bag.cert && bag.cert.getExtension('basicConstraints')?.cA !== true) {
      cert = bag.cert
      break
    }
  }

  return {
    privateKeyPem: forge.pki.privateKeyToPem(keyBags[0].key),
    certificatePem: forge.pki.certificateToPem(cert),
  }
}

/** Algoritmos fixos do schema xmldsig da NF-e/NFC-e (MOC) — exclusive C14N gera 225 em Algorithm. */
const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
const RSA_SHA1 = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'
const SHA1 = 'http://www.w3.org/2000/09/xmldsig#sha1'
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature'

/**
 * Assina o XML da NFC-e (enveloped, RSA-SHA1, C14N inclusivo do MOC).
 * Entrada: fragmento <infNFe ...>...</infNFe>
 * Saída: <NFe xmlns="...">infNFe + Signature</NFe>
 */
export function assinarNFeXml(xmlInfNFe, pfx, passphrase) {
  const { privateKeyPem, certificatePem } = extractPfxPem(pfx, passphrase)
  const idMatch = /Id="(NFe\d{44})"/i.exec(xmlInfNFe)
  if (!idMatch) {
    throw new Error('infNFe sem atributo Id=NFe{chave}.')
  }
  const referenceUri = `#${idMatch[1]}`

  const nfeXml = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">${xmlInfNFe}</NFe>`

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certificatePem,
    signatureAlgorithm: RSA_SHA1,
    canonicalizationAlgorithm: C14N,
  })

  sig.addReference({
    xpath: "//*[local-name(.)='infNFe']",
    transforms: [ENVELOPED, C14N],
    digestAlgorithm: SHA1,
    uri: referenceUri,
    isEmptyUri: false,
  })

  sig.computeSignature(nfeXml, {
    location: {
      reference: "//*[local-name(.)='infNFe']",
      action: 'after',
    },
    prefix: '',
  })

  const signed = sig.getSignedXml()
  // Garante serialização estável
  const doc = new DOMParser().parseFromString(signed, 'text/xml')
  return new XMLSerializer().serializeToString(doc)
}
