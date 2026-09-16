/**
 * Configuração fiscal (NFC-e / NF-e).
 * Browser → serviço compartilhado → mock local ou ponte :39102.
 */
export const FISCAL_CONFIG = {
  /**
   * mock = emite/autoriza em memória (sem SEFAZ)
   * live = POST /api/fiscal/transmitir → SEFAZ com certificado A1 da filial
   *
   * Para produção/homologação real: mode: 'live' + .pfx, CSC e IE na filial.
   */
  mode: 'mock' as 'mock' | 'live',
  bridgeUrl: 'http://127.0.0.1:39102',
  /**
   * true = envia ESC/POS RAW pela ponte :39102 (sem diálogo do Windows),
   * igual ao ACBr. Exige `npm run fiscal-bridge` rodando.
   */
  directPrint: true,
  /** Nome da fila Windows. Vazio = padrão do SO / Elgin. */
  printerName: 'ELGIN i8 (copy 1)',
  /** Dados do emitente (DANFE simplificado). */
  emitter: {
    razaoSocial: 'POSTO DEMO PDV LTDA',
    nomeFantasia: 'Posto Demo',
    cnpj: '00.000.000/0001-00',
    ie: 'ISENTO',
    endereco: 'Av. Exemplo, 1000',
    bairro: 'Centro',
    cidade: 'São Paulo',
    uf: 'SP',
    cep: '01000-000',
    telefone: '(11) 0000-0000',
  },
  series: {
    'NFC-e': '1',
    'NF-e': '1',
  } as const,
  /** Após autorizar NF-e, envia automaticamente ao destinatário. */
  autoSendNfe: true,
  /** Após autorizar, imprime (NFC-e não-fiscal / NF-e simplificado). */
  autoPrint: true,
  /** Ambiente informado no cupom. */
  ambiente: 'Homologação' as 'Homologação' | 'Produção',
}
