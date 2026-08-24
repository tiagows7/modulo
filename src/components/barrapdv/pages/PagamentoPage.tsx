import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAlert } from '../context/AlertContext'
import { useCart } from '../context/CartContext'
import { formatCurrency, paymentMethods, posCardOptions, vehicles } from '../data/mock'
import { consultarCnpj } from '../services/document/cnpjPublic'
import {
  formatCpfCnpj,
  isValidCnpj,
  onlyDigits,
} from '../services/document/documentValidator'
import { fiveServiceTef } from '../services/tef/fiveServiceTef'
import type { TefMethod, TefTransactionState } from '../services/tef/types'
import { fiscalService, type FiscalDocument } from '../services/fiscal'
import { validarCupom } from '../services/cupom/validarCupom'
import { lineNetTotal } from '../services/cupom/aplicarDesconto'

type CustomerData = {
  document: string
  customerCode: string
  name: string
  cep: string
  address: string
  number: string
  city: string
  neighborhood: string
  uf: string
  phone: string
  stateRegistration: string
  plate: string
  km: string
  fleet: string
  authorization: string
  driver: string
  agency: string
  registration: string
  notes: string
}

const emptyCustomer: CustomerData = {
  document: '',
  customerCode: '',
  name: '',
  cep: '',
  address: '',
  number: '',
  city: '',
  neighborhood: '',
  uf: '',
  phone: '',
  stateRegistration: '',
  plate: '',
  km: '',
  fleet: '',
  authorization: '',
  driver: '',
  agency: '',
  registration: '',
  notes: '',
}

type PayLine = {
  id: string
  methodId: string
  /** Detalhe ex.: bandeira do cartão POS. */
  detail?: string
  amount: number
  status: 'pending' | 'approved' | 'error'
  cashReceived: number
  tefState: TefTransactionState | null
  error: string | null
}

function isTefMethodId(id: string) {
  return id === 'tef' || id === 'pix'
}

function methodLabel(id: string, detail?: string) {
  const base = paymentMethods.find((m) => m.id === id)?.label ?? id
  return detail ? `${base} · ${detail}` : base
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

/** Comparação em centavos — evita “valor incompleto” com totais iguais na tela. */
function moneyCents(value: number) {
  return Math.round(roundMoney(value) * 100)
}

function newPayLineId() {
  return `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function PagamentoPage() {
  const navigate = useNavigate()
  const { showAlert, showConfirm } = useAlert()
  const { cart, subtotal, total, discountTotal, clearCart, applyDiscountCoupon } = useCart()
  const [step, setStep] = useState<'pagamento' | 'cliente'>('pagamento')
  const [customer, setCustomer] = useState<CustomerData>(emptyCustomer)
  const [payLines, setPayLines] = useState<PayLine[]>([])
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null)
  const [methodInputs, setMethodInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(paymentMethods.map((m) => [m.id, ''])),
  )
  const [done, setDone] = useState(false)
  const [lastFiscalDoc, setLastFiscalDoc] = useState<FiscalDocument | null>(null)
  const [fiscalBusy, setFiscalBusy] = useState(false)
  const [showVehicleSearch, setShowVehicleSearch] = useState(false)
  const [vehicleQuery, setVehicleQuery] = useState('')
  const [consultingCnpj, setConsultingCnpj] = useState(false)
  const [discountCouponCode, setDiscountCouponCode] = useState('')
  const [discountCouponLabel, setDiscountCouponLabel] = useState<string | null>(null)
  const [consultingDiscountCoupon, setConsultingDiscountCoupon] = useState(false)
  const [posPopup, setPosPopup] = useState<{ amount: number } | null>(null)
  const [tefBusy, setTefBusy] = useState(false)
  const [tefFieldInput, setTefFieldInput] = useState('')
  const [tefSession, setTefSession] = useState<{
    lineId: string
    methodId: string
    amount: number
    index: number
    total: number
    state: TefTransactionState | null
    error: string | null
  } | null>(null)
  const tefTxIdRef = useRef<string | null>(null)
  const payLinesRef = useRef(payLines)
  payLinesRef.current = payLines

  async function enviarEntradaTef(value: string) {
    const id = tefTxIdRef.current
    if (!id || !tefSession) return
    try {
      const state = await fiveServiceTef.submitInput(id, value)
      setTefFieldInput('')
      updateLine(tefSession.lineId, { tefState: state })
      setTefSession((prev) => (prev ? { ...prev, state } : prev))
    } catch (err) {
      showAlert({
        title: 'TEF',
        message: err instanceof Error ? err.message : 'Falha ao enviar dado ao TEF',
      })
    }
  }

  /** Digita o código da opção do menu TEF pelo teclado (sem mouse). */
  const tefMenuKey =
    tefSession?.state?.status === 'waiting_menu' && tefSession.state.menuOptions?.length
      ? tefSession.state.menuOptions.map((o) => `${o.code}:${o.label}`).join('|')
      : ''

  useEffect(() => {
    if (!tefMenuKey || tefSession?.state?.status !== 'waiting_menu') return
    const options = tefSession.state.menuOptions
    if (!options?.length) return

    let buffer = ''
    let flushTimer: ReturnType<typeof setTimeout> | null = null

    const clearBuffer = () => {
      buffer = ''
      if (flushTimer) {
        clearTimeout(flushTimer)
        flushTimer = null
      }
    }

    const trySubmit = (code: string) => {
      const match = options.find((o) => o.code === code)
      if (!match) return false
      clearBuffer()
      void enviarEntradaTef(match.code)
      return true
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }

      if (e.key === 'Escape') {
        clearBuffer()
        return
      }

      if (e.key === 'Enter' && buffer) {
        e.preventDefault()
        if (!trySubmit(buffer)) clearBuffer()
        return
      }

      if (e.key === 'Backspace' && buffer) {
        e.preventDefault()
        buffer = buffer.slice(0, -1)
        return
      }

      const digit =
        e.code?.startsWith('Digit') || e.code?.startsWith('Numpad')
          ? e.key
          : /^[0-9]$/.test(e.key)
            ? e.key
            : null
      if (digit == null) return

      e.preventDefault()
      buffer += digit

      // Código completo (ex.: "2") → envia na hora
      if (trySubmit(buffer)) return

      const prefixes = options.filter((o) => o.code.startsWith(buffer))
      if (prefixes.length === 0) {
        clearBuffer()
        return
      }

      if (flushTimer) clearTimeout(flushTimer)
      flushTimer = setTimeout(() => {
        trySubmit(buffer)
        clearBuffer()
      }, 700)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      clearBuffer()
      window.removeEventListener('keydown', onKeyDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tefMenuKey estabiliza opções entre polls
  }, [tefMenuKey])

  const paidTotal = useMemo(
    () => roundMoney(payLines.reduce((sum, line) => sum + line.amount, 0)),
    [payLines],
  )
  const remaining = roundMoney(Math.max(0, total - paidTotal))
  const cashChange = useMemo(() => {
    return payLines.reduce((sum, line) => {
      if (line.methodId !== 'dinheiro') return sum
      return sum + Math.max(0, line.cashReceived - line.amount)
    }, 0)
  }, [payLines])

  /** Quando o pago cobre o total, aciona Fechar venda automaticamente (uma vez por cobertura). */
  const saleCoveredRef = useRef(false)
  useEffect(() => {
    const covered =
      step === 'pagamento' &&
      !done &&
      !posPopup &&
      payLines.length > 0 &&
      moneyCents(paidTotal) >= moneyCents(total)

    if (!covered) {
      saleCoveredRef.current = false
      return
    }
    if (saleCoveredRef.current || tefBusy || fiscalBusy) return
    saleCoveredRef.current = true
    void fecharVenda()
    // fecharVenda é estável o suficiente no fluxo; evitamos re-disparo com saleCoveredRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidTotal, total, payLines.length, done, tefBusy, fiscalBusy, step, posPopup])

  function tefHeadline(state: TefTransactionState | null, methodId: string) {
    if (!state) return `Iniciando ${methodLabel(methodId)}…`
    switch (state.status) {
      case 'starting':
        return 'Preparando pagamento'
      case 'waiting_card':
        return 'Aguardando cartão'
      case 'waiting_pin':
        return 'Senha no pinpad'
      case 'waiting_pix':
        return 'Aguardando PIX'
      case 'waiting_menu':
        return 'Escolha a forma de pagamento'
      case 'waiting_field':
        return 'Informe o dado solicitado'
      case 'waiting_confirm':
        return 'Confirmação'
      case 'waiting_key':
        return 'Mensagem do TEF'
      case 'processing':
        return 'Autorizando'
      case 'approved':
        return 'Pagamento aprovado'
      case 'denied':
        return 'Pagamento negado'
      case 'cancelled':
        return 'Pagamento cancelado'
      case 'error':
        return 'Falha no TEF'
      default:
        return state.message || 'Processando TEF'
    }
  }

  function tefDetail(state: TefTransactionState | null) {
    if (!state) return 'Comunicando com a CliSiTef…'
    if (state.status === 'waiting_card') return 'Aproxime, insira ou passe o cartão no pinpad.'
    if (state.status === 'waiting_pin') return 'Peça ao cliente para digitar a senha.'
    if (state.status === 'waiting_pix') return 'Mostre o QR Code ou aguarde a confirmação do banco.'
    if (state.status === 'waiting_menu') {
      return state.menuTitle || 'Selecione no PDV a opção desejada (não use Cheque se for cartão).'
    }
    if (state.status === 'waiting_field') {
      return state.fieldPrompt?.prompt || state.message || 'Digite o valor solicitado pela CliSiTef.'
    }
    if (state.status === 'waiting_confirm') {
      return state.fieldPrompt?.prompt || state.message || 'Confirma a operação?'
    }
    if (state.status === 'waiting_key') return state.message || 'Toque em OK para continuar.'
    if (state.status === 'processing') return 'Aguarde a resposta do autorizador.'
    if (state.status === 'approved') return 'Transação autorizada com sucesso.'
    return state.message || state.error || 'Aguarde…'
  }

  async function cancelRunningTef() {
    fiveServiceTef.stopWatch()
    const id = tefTxIdRef.current
    if (id) {
      await fiveServiceTef.cancel(id).catch(() => undefined)
    }
    tefTxIdRef.current = null
    setTefBusy(false)
    setTefSession(null)
    setTefFieldInput('')
  }

  /** Cancelamento com confirmação Sim/Não (fluxo TEF). */
  async function pedirCancelamentoTef(message?: string) {
    const ok = await showConfirm({
      title: 'Cancelar TEF',
      message: message || 'Deseja cancelar a operação TEF?',
      yesLabel: 'Sim',
      noLabel: 'Não',
    })
    if (!ok) return false
    await cancelRunningTef()
    return true
  }

  /** Volta à etapa anterior da coleta CliSiTef (menu/campo/confirmação). */
  async function voltarEtapaTef() {
    const id = tefTxIdRef.current
    if (!id) return
    setTefFieldInput('')
    try {
      await fiveServiceTef.goBack(id)
    } catch (err) {
      console.warn('[TEF] voltar etapa:', err)
    }
  }

  async function cancelarTefEVoltar() {
    if (tefBusy || tefSession || tefTxIdRef.current) {
      const ok = await pedirCancelamentoTef(
        'Deseja cancelar a operação TEF e voltar para a venda?',
      )
      if (!ok) return
    } else {
      const ok = await showConfirm({
        title: 'Cancelar',
        message: 'Deseja cancelar e voltar para a venda?',
        yesLabel: 'Sim',
        noLabel: 'Não',
      })
      if (!ok) return
    }
    navigate('/venda')
  }

  function updateLine(id: string, patch: Partial<PayLine>) {
    setPayLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)))
  }

  function parseMoneyInput(raw: string) {
    const normalized = raw.trim().replace(/\./g, '').replace(',', '.')
    const value = Number(normalized)
    return Number.isFinite(value) ? roundMoney(value) : 0
  }

  function setMethodInput(methodId: string, value: string) {
    setMethodInputs((prev) => ({ ...prev, [methodId]: value }))
  }

  function addDocumentLine(methodId: string, amount: number, detail?: string) {
    void cancelRunningTef()
    const line: PayLine = {
      id: newPayLineId(),
      methodId,
      detail,
      amount,
      status: isTefMethodId(methodId) ? 'pending' : 'approved',
      cashReceived: methodId === 'dinheiro' ? amount : 0,
      tefState: null,
      error: null,
    }
    setPayLines((prev) => [...prev, line])
    setSelectedLineId(line.id)
    setMethodInput(methodId, '')
  }

  function addDocumentFromInput(methodId: string) {
    const typed = parseMoneyInput(methodInputs[methodId] || '')
    // Campo vazio/zerado + Enter → usa o restante da venda.
    const amount = typed > 0 ? typed : remaining
    if (amount <= 0) {
      showAlert({
        title: 'Valor inválido',
        message:
          remaining <= 0
            ? 'A venda já está coberta pelos documentos lançados.'
            : 'Informe um valor maior que zero ou deixe em branco para usar o restante.',
      })
      return
    }

    if (methodId === 'cartao_pos') {
      setPosPopup({ amount })
      return
    }

    addDocumentLine(methodId, amount)
  }

  function confirmarCartaoPos(optionId: string, optionLabel: string) {
    if (!posPopup) return
    addDocumentLine('cartao_pos', posPopup.amount, optionLabel)
    setPosPopup(null)
    void optionId
  }

  function removeDocument(id: string) {
    const line = payLines.find((l) => l.id === id)
    if (line && isTefMethodId(line.methodId) && tefTxIdRef.current && selectedLineId === id) {
      void cancelRunningTef()
    }
    setPayLines((prev) => prev.filter((l) => l.id !== id))
    if (selectedLineId === id) setSelectedLineId(null)
  }

  function selectLine(id: string) {
    if (tefBusy) return
    setSelectedLineId(id)
  }

  /** Processa um documento TEF; retorna true se aprovado. */
  async function processTefLine(
    line: PayLine,
    index: number,
    totalCount: number,
  ): Promise<boolean> {
    setSelectedLineId(line.id)
    setTefSession({
      lineId: line.id,
      methodId: line.methodId,
      amount: line.amount,
      index,
      total: totalCount,
      state: null,
      error: null,
    })
    updateLine(line.id, { error: null, status: 'pending', tefState: null })

    try {
      const health = await fiveServiceTef.health()
      if (!health.ok) {
        throw new Error(
          health.message || 'Ponte TEF offline. No terminal rode: npm run tef-bridge',
        )
      }

      const started = await fiveServiceTef.start({
        method: line.methodId as TefMethod,
        amount: line.amount,
        cupom: `${Date.now().toString().slice(-8)}`,
      })
      tefTxIdRef.current = started.transactionId
      updateLine(line.id, { tefState: started })
      setTefSession((prev) => (prev ? { ...prev, state: started } : prev))

      const finalState = await fiveServiceTef.watch(started.transactionId, (state) => {
        updateLine(line.id, { tefState: state })
        setTefSession((prev) => (prev ? { ...prev, state } : prev))
      })

      if (finalState.status === 'approved') {
        await fiveServiceTef.confirm(finalState.transactionId)
        const confirmed = { ...finalState, message: 'Pagamento confirmado' }
        updateLine(line.id, { status: 'approved', tefState: confirmed, error: null })
        setTefSession((prev) => (prev ? { ...prev, state: confirmed, error: null } : prev))
        await new Promise((r) => setTimeout(r, 700))
        return true
      }

      const err =
        finalState.error ||
        finalState.message ||
        (finalState.status === 'cancelled' ? 'Transação cancelada' : 'Transação não aprovada')
      updateLine(line.id, { status: 'error', error: err, tefState: finalState })
      setTefSession((prev) => (prev ? { ...prev, state: finalState, error: err } : prev))
      return false
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha na comunicação TEF'
      updateLine(line.id, { status: 'error', error: message })
      setTefSession((prev) => (prev ? { ...prev, error: message } : prev))
      return false
    } finally {
      tefTxIdRef.current = null
    }
  }

  async function emitirDocumentoFiscal() {
    const saleRef = `PDV${Date.now().toString().slice(-6)}`
    const result = await fiscalService.emitAndFinalize(
      {
        items: cart,
        buyer: {
          document: customer.document,
          name: customer.name,
          customerCode: customer.customerCode,
          ie: customer.stateRegistration,
          cep: customer.cep,
          address: customer.address,
          number: customer.number,
          neighborhood: customer.neighborhood,
          city: customer.city,
          uf: customer.uf,
          phone: customer.phone,
          plate: customer.plate,
          km: customer.km,
          fleet: customer.fleet,
          driver: customer.driver,
          notes: customer.notes,
        },
        payments: payLinesRef.current.map((line) => ({
          methodId: line.methodId,
          label: methodLabel(line.methodId, line.detail),
          amount: line.amount,
          nsu: line.tefState?.nsu || undefined,
          authorizationCode: line.tefState?.authorizationCode || undefined,
          brand: line.detail || line.tefState?.brand || undefined,
        })),
        saleRef,
        total,
      },
      {
        // Impressão fica no botão "Imprimir cupom" / reimpressão — evita popup no fechamento.
        print: false,
      },
    )
    setLastFiscalDoc(result.document)
    return result
  }

  async function fecharVenda() {
    if (tefBusy || fiscalBusy) return
    const paidCents = moneyCents(paidTotal)
    const totalCents = moneyCents(total)
    if (payLines.length === 0 || paidCents < totalCents) {
      showAlert({
        title: 'Valor incompleto',
        message: `O valor informado (${formatCurrency(roundMoney(paidTotal))}) precisa ser igual ou maior que o total da venda (${formatCurrency(roundMoney(total))}).`,
      })
      return
    }

    const pendingTef = payLinesRef.current.filter(
      (line) => isTefMethodId(line.methodId) && line.status !== 'approved',
    )

    if (pendingTef.length > 0) {
      setTefBusy(true)
      for (let i = 0; i < pendingTef.length; i++) {
        const ok = await processTefLine(pendingTef[i], i + 1, pendingTef.length)
        if (!ok) {
          setTefBusy(false)
          return
        }
      }
      setTefBusy(false)
      setTefSession(null)
    }

    setFiscalBusy(true)
    try {
      const result = await emitirDocumentoFiscal()
      const doc = result.document
      setLastFiscalDoc(doc)

      const combustivelIds = cart
        .filter((item) => item.kind === 'combustivel')
        .map((item) => item.id)
      if (combustivelIds.length > 0) {
        try {
          const { setDocumentoCupom } = await import(
            '../services/concentrador/abastecimentosDb'
          )
          await setDocumentoCupom(combustivelIds, {
            documento: doc.tipo || 'NFC-e',
            cupom: String(doc.numero ?? doc.id ?? ''),
          })
        } catch (err) {
          console.warn('[pagamento] atualizar documento/cupom:', err)
        }
      }

      const sendInfo = result.send?.ok ? `\nEnvio NF-e: ${result.send.sentTo}` : ''
      const querImprimir = await showConfirm({
        title: 'Imprimir cupom',
        message: `${doc.tipo} nº ${doc.numero} autorizada · ${formatCurrency(doc.valor)}.${sendInfo}\n\nDeseja imprimir o cupom?`,
        yesLabel: 'Sim',
        noLabel: 'Não',
      })

      if (querImprimir) {
        const printResult = await fiscalService.print({
          documentId: doc.id,
          // Impressão direta (ESC/POS) — sem diálogo do Windows.
          openDialog: false,
          direct: true,
        })
        showAlert({
          title: printResult.ok ? 'Cupom impresso' : 'Cupom',
          message: printResult.message,
        })
      }

      // Final da rotina: inicia nova venda automaticamente (sem perguntar).
      setDone(true)
      clearCart()
      setLastFiscalDoc(null)
      setPayLines([])
      setSelectedLineId(null)
      saleCoveredRef.current = false
      navigate('/venda')
    } catch (err) {
      showAlert({
        title: 'Falha fiscal',
        message:
          err instanceof Error
            ? err.message
            : 'Não foi possível emitir NFC-e / NF-e.',
      })
    } finally {
      setFiscalBusy(false)
    }
  }

  /** Reimprime o último cupom direto na térmica (sem diálogo Windows). */
  async function imprimirUltimoCupom() {
    if (!lastFiscalDoc) {
      showAlert({
        title: 'Cupom',
        message: 'Nenhum documento fiscal nesta venda.',
      })
      return
    }
    try {
      const result = await fiscalService.print({
        documentId: lastFiscalDoc.id,
        openDialog: false,
        direct: true,
      })
      showAlert({
        title: result.ok ? 'Cupom impresso' : 'Cupom',
        message: result.message,
      })
    } catch (err) {
      showAlert({
        title: 'Cupom',
        message: err instanceof Error ? err.message : 'Falha ao imprimir cupom.',
      })
    }
  }

  const filteredVehicles = useMemo(() => {
    const q = vehicleQuery.trim().toLowerCase()
    if (!q) return vehicles
    return vehicles.filter(
      (v) =>
        v.plate.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.fleet.toLowerCase().includes(q) ||
        v.driver.toLowerCase().includes(q) ||
        v.customerName.toLowerCase().includes(q) ||
        v.customerCode.toLowerCase().includes(q),
    )
  }, [vehicleQuery])

  const matchedVehicle = useMemo(() => {
    const plate = customer.plate.trim().toUpperCase()
    if (!plate) return null
    return vehicles.find((v) => v.plate.toUpperCase() === plate) ?? null
  }, [customer.plate])

  function updateCustomer<K extends keyof CustomerData>(key: K, value: CustomerData[K]) {
    setCustomer((prev) => ({ ...prev, [key]: value }))
  }

  async function consultarDocumento() {
    const digits = onlyDigits(customer.document)
    if (digits.length === 11) {
      showAlert({
        title: 'Consulta disponível para CNPJ',
        message:
          'A consulta automática (mesmo molde do AppSiTef) funciona com CNPJ. Informe um CNPJ com 14 dígitos e clique em Consultar.',
      })
      return
    }
    if (digits.length !== 14 || !isValidCnpj(digits)) {
      showAlert({
        title: 'CNPJ inválido',
        message: 'Informe um CNPJ válido com 14 dígitos para consultar.',
      })
      return
    }

    setConsultingCnpj(true)
    try {
      const data = await consultarCnpj(digits)
      setCustomer((prev) => ({
        ...prev,
        document: formatCpfCnpj(data.cnpj),
        name: data.name || prev.name,
        cep: data.cep || prev.cep,
        address: data.address || prev.address,
        number: data.number || prev.number,
        neighborhood: data.neighborhood || prev.neighborhood,
        city: data.city || prev.city,
        uf: data.uf || prev.uf,
        phone: data.phone || prev.phone,
        stateRegistration: data.stateRegistration || prev.stateRegistration,
      }))
    } catch (err) {
      showAlert({
        title: 'Falha na consulta',
        message: err instanceof Error ? err.message : 'Não foi possível consultar o CNPJ.',
      })
    } finally {
      setConsultingCnpj(false)
    }
  }

  async function consultarCupomDesconto() {
    const code = discountCouponCode.trim()
    if (!code) {
      showAlert({
        title: 'Cupom de desconto',
        message: 'CODIGO NÃO INFORMADO',
      })
      return
    }

    if (!/^\d+$/.test(code)) {
      showAlert({
        title: 'Cupom de desconto',
        message: 'Informe apenas o código numérico do cupom.',
      })
      return
    }

    setConsultingDiscountCoupon(true)
    setDiscountCouponLabel(null)
    try {
      const result = await validarCupom(code)
      if (!result.ok) {
        showAlert({
          title: 'Cupom de desconto',
          message: result.mensagem || 'Cupom inválido ou já utilizado',
        })
        return
      }

      // Sem banco PDV: ignora CNPJ/produto — aplica só pelo tipo de desconto.
      const applied = applyDiscountCoupon({
        couponCode: code,
        tipo: result.tipo,
        valor: result.valor,
        matchProduct: false,
      })

      if (!applied.aplicado) {
        setDiscountCouponLabel(null)
        showAlert({
          title: 'Cupom de desconto',
          message: `Tipo de desconto não reconhecido: ${result.tipo || '(vazio)'}`,
        })
        return
      }

      setDiscountCouponLabel(code)
      showAlert({
        title: 'Cupom de desconto',
        message: result.mensagem || 'Cupom válido!',
      })
    } catch (err) {
      setDiscountCouponLabel(null)
      showAlert({
        title: 'Cupom de desconto',
        message: err instanceof Error ? err.message : 'Não foi possível consultar o cupom.',
      })
    } finally {
      setConsultingDiscountCoupon(false)
    }
  }

  function selectVehicle(vehicleId: string) {
    const vehicle = vehicles.find((v) => v.id === vehicleId)
    if (!vehicle) return
    setCustomer((prev) => ({
      ...prev,
      plate: vehicle.plate,
      fleet: vehicle.fleet,
      driver: vehicle.driver,
      customerCode: vehicle.customerCode || prev.customerCode,
      name: prev.name || vehicle.customerName,
      agency: prev.agency || vehicle.customerName,
    }))
    setShowVehicleSearch(false)
    setVehicleQuery('')
  }

  function confirmarIdentificacao() {
    if (!customer.name.trim() && !customer.document.trim() && !customer.customerCode.trim()) {
      showAlert({
        title: 'Cliente incompleto',
        message: 'Informe o CPF/CNPJ, o código ou o nome do cliente para continuar.',
      })
      return
    }
    setStep('pagamento')
  }

  function limparCliente() {
    setCustomer(emptyCustomer)
  }

  function novaVenda() {
    setLastFiscalDoc(null)
    clearCart()
    navigate('/venda')
  }

  if (cart.length === 0 && !done) {
    return (
      <div className="panel" style={{ maxWidth: 480, margin: '40px auto', padding: 28, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Nenhum item no cupom para pagar.</p>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/venda')}>
          Voltar para venda
        </button>
      </div>
    )
  }

  if (done) {
    return (
      <div className="panel" style={{ maxWidth: 520, margin: '40px auto', padding: 32, textAlign: 'center' }}>
        <div className="chip ok" style={{ marginBottom: 16 }}>
          {lastFiscalDoc
            ? `${lastFiscalDoc.tipo} ${lastFiscalDoc.numero} autorizada`
            : 'Pagamento confirmado'}
        </div>
        <div className="amount-box">
          <div className="label">Valor recebido</div>
          <div className="value">{formatCurrency(total)}</div>
        </div>
        <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>
          Cliente: {customer.name || customer.customerCode || 'Não informado'}
        </p>
        <p style={{ color: 'var(--text-muted)' }}>
          Documentos:{' '}
          {payLines.map((l) => `${methodLabel(l.methodId, l.detail)} ${formatCurrency(l.amount)}`).join(' · ')}
        </p>
        {lastFiscalDoc ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 8 }}>
            Chave: {lastFiscalDoc.chave}
            {lastFiscalDoc.sentTo ? ` · Enviada: ${lastFiscalDoc.sentTo}` : ''}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button type="button" className="btn btn-secondary btn-lg btn-block" onClick={novaVenda}>
            Nova venda
          </button>
          <button
            type="button"
            className="btn btn-primary btn-lg btn-block"
            onClick={() => void imprimirUltimoCupom()}
            disabled={!lastFiscalDoc}
          >
            Ver cupom
          </button>
        </div>
      </div>
    )
  }

  if (step === 'cliente') {
    return (
      <div className="customer-layout">
        {showVehicleSearch && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="vehicle-search-title">
            <div className="modal-card vehicle-search-modal">
              <h2 id="vehicle-search-title">Pesquisar veículo</h2>
              <div className="field" style={{ marginBottom: 12, textAlign: 'left' }}>
                <label htmlFor="vehicle-query">Placa, frota, motorista ou cliente</label>
                <input
                  id="vehicle-query"
                  value={vehicleQuery}
                  onChange={(e) => setVehicleQuery(e.target.value)}
                  placeholder="Digite para filtrar…"
                  autoFocus
                />
              </div>
              <div className="vehicle-search-list">
                {filteredVehicles.length === 0 ? (
                  <div className="empty">Nenhum veículo encontrado.</div>
                ) : (
                  filteredVehicles.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className="vehicle-search-item"
                      onClick={() => selectVehicle(v.id)}
                    >
                      <strong>{v.plate}</strong>
                      <span>
                        {v.model} · {v.fleet}
                      </span>
                      <span>
                        {v.driver} · {v.customerCode} — {v.customerName}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-lg"
                style={{ marginTop: 14 }}
                onClick={() => {
                  setShowVehicleSearch(false)
                  setVehicleQuery('')
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        )}

        <section className="panel customer-panel">
          <div className="panel-header">
            <h2>Identificar cliente</h2>
            <button type="button" className="btn btn-ghost" onClick={() => setStep('pagamento')}>
              Voltar
            </button>
          </div>

          <div className="customer-form">
            <div className="customer-summary">
              <span className="chip">Total da venda</span>
              <strong>{formatCurrency(total)}</strong>
            </div>

            <div className="customer-fields">
              <div className="customer-doc-row">
                <div className="field field-code">
                  <label htmlFor="customer-code">Código do cliente</label>
                  <input
                    id="customer-code"
                    value={customer.customerCode}
                    onChange={(e) => updateCustomer('customerCode', e.target.value)}
                    placeholder="Ex.: C001"
                    disabled={consultingCnpj}
                    autoFocus
                  />
                </div>

                <div className="field field-document">
                  <label htmlFor="customer-document">CPF / CNPJ</label>
                  <div className="field-with-action">
                    <input
                      id="customer-document"
                      value={customer.document}
                      onChange={(e) => updateCustomer('document', formatCpfCnpj(e.target.value))}
                      placeholder="00.000.000/0000-00"
                      inputMode="numeric"
                      disabled={consultingCnpj}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        void consultarDocumento()
                      }}
                      disabled={consultingCnpj}
                      title="Consultar CNPJ na Receita (publica.cnpj.ws)"
                    >
                      {consultingCnpj ? '…' : 'Consultar'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="field field-full">
                <label htmlFor="customer-name">Nome / Razão social</label>
                <input
                  id="customer-name"
                  value={customer.name}
                  onChange={(e) => updateCustomer('name', e.target.value)}
                  placeholder="Nome do cliente"
                  disabled={consultingCnpj}
                />
              </div>

              <div className="field">
                <label htmlFor="customer-cep">CEP</label>
                <input
                  id="customer-cep"
                  value={customer.cep}
                  onChange={(e) => updateCustomer('cep', e.target.value)}
                  placeholder="00000-000"
                  inputMode="numeric"
                  disabled={consultingCnpj}
                />
              </div>

              <div className="field field-address">
                <label htmlFor="customer-address">Endereço</label>
                <input
                  id="customer-address"
                  value={customer.address}
                  onChange={(e) => updateCustomer('address', e.target.value)}
                  placeholder="Rua / Avenida"
                  disabled={consultingCnpj}
                />
              </div>

              <div className="field field-number">
                <label htmlFor="customer-number">Número</label>
                <input
                  id="customer-number"
                  value={customer.number}
                  onChange={(e) => updateCustomer('number', e.target.value)}
                  placeholder="Nº"
                  disabled={consultingCnpj}
                />
              </div>

              <div className="field">
                <label htmlFor="customer-neighborhood">Bairro</label>
                <input
                  id="customer-neighborhood"
                  value={customer.neighborhood}
                  onChange={(e) => updateCustomer('neighborhood', e.target.value)}
                  placeholder="Bairro"
                  disabled={consultingCnpj}
                />
              </div>

              <div className="field">
                <label htmlFor="customer-city">Cidade</label>
                <input
                  id="customer-city"
                  value={customer.city}
                  onChange={(e) => updateCustomer('city', e.target.value)}
                  placeholder="Cidade"
                  disabled={consultingCnpj}
                />
              </div>

              <div className="field field-uf">
                <label htmlFor="customer-uf">UF</label>
                <input
                  id="customer-uf"
                  value={customer.uf}
                  onChange={(e) => updateCustomer('uf', e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="UF"
                  maxLength={2}
                  disabled={consultingCnpj}
                />
              </div>

              <div className="field">
                <label htmlFor="customer-phone">DDD — Fone</label>
                <input
                  id="customer-phone"
                  value={customer.phone}
                  onChange={(e) => updateCustomer('phone', e.target.value)}
                  placeholder="(00) 00000-0000"
                  inputMode="tel"
                  disabled={consultingCnpj}
                />
              </div>

              <div className="field">
                <label htmlFor="customer-ie">Inscrição estadual</label>
                <input
                  id="customer-ie"
                  value={customer.stateRegistration}
                  onChange={(e) => updateCustomer('stateRegistration', e.target.value)}
                  placeholder="IE / ISENTO"
                  disabled={consultingCnpj}
                />
              </div>
            </div>

            <div className="customer-actions">
              <button type="button" className="btn btn-secondary btn-lg" onClick={limparCliente}>
                Limpar dados
              </button>
              <button type="button" className="btn btn-primary btn-lg" onClick={confirmarIdentificacao}>
                Confirmar cliente
              </button>
            </div>
          </div>
        </section>

        <section className="panel customer-vehicle-side">
          <div className="panel-header">
            <h2>Outras informações</h2>
          </div>
          <div className="customer-form">
            {matchedVehicle && (
              <div className="vehicle-match-card">
                <div className="vehicle-match-plate">{matchedVehicle.plate}</div>
                <strong>{matchedVehicle.model}</strong>
                <span>
                  Frota {matchedVehicle.fleet} · Motorista {matchedVehicle.driver}
                </span>
                <span>
                  Cliente {matchedVehicle.customerCode} — {matchedVehicle.customerName}
                </span>
              </div>
            )}

            <div className="customer-fields">
              <div className="field field-plate field-full">
                <label htmlFor="customer-plate">Placa do veículo</label>
                <div className="field-with-action">
                  <input
                    id="customer-plate"
                    value={customer.plate}
                    onChange={(e) => updateCustomer('plate', e.target.value.toUpperCase())}
                    placeholder="ABC1D23"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowVehicleSearch(true)}
                    title="Pesquisar na tabela de veículos"
                  >
                    Buscar
                  </button>
                </div>
              </div>

              <div className="field">
                <label htmlFor="customer-km">KM</label>
                <input
                  id="customer-km"
                  value={customer.km}
                  onChange={(e) => updateCustomer('km', e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                />
              </div>

              <div className="field">
                <label htmlFor="customer-fleet">Frota</label>
                <input
                  id="customer-fleet"
                  value={customer.fleet}
                  onChange={(e) => updateCustomer('fleet', e.target.value)}
                  placeholder="Código da frota"
                />
              </div>

              <div className="field">
                <label htmlFor="customer-authorization">Autorização</label>
                <input
                  id="customer-authorization"
                  value={customer.authorization}
                  onChange={(e) => updateCustomer('authorization', e.target.value)}
                  placeholder="Nº da autorização"
                />
              </div>

              <div className="field">
                <label htmlFor="customer-driver">Motorista</label>
                <input
                  id="customer-driver"
                  value={customer.driver}
                  onChange={(e) => updateCustomer('driver', e.target.value)}
                  placeholder="Nome do motorista"
                />
              </div>

              <div className="field">
                <label htmlFor="customer-agency">Órgão</label>
                <input
                  id="customer-agency"
                  value={customer.agency}
                  onChange={(e) => updateCustomer('agency', e.target.value)}
                  placeholder="Órgão / empresa"
                />
              </div>

              <div className="field">
                <label htmlFor="customer-registration">Matrícula</label>
                <input
                  id="customer-registration"
                  value={customer.registration}
                  onChange={(e) => updateCustomer('registration', e.target.value)}
                  placeholder="Matrícula"
                />
              </div>

              <div className="field field-full">
                <label htmlFor="customer-notes">Observação</label>
                <textarea
                  id="customer-notes"
                  value={customer.notes}
                  onChange={(e) => updateCustomer('notes', e.target.value)}
                  placeholder="Observações da venda…"
                  rows={2}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="pay-layout">
      <section className="panel pay-panel">
        <div className="panel-header panel-header-compact">
          <h2>Forma de pagamento</h2>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/venda')}>
            Voltar
          </button>
        </div>

        <div className="customer-identify">
          <div className="customer-badge">
            <span>Cliente</span>
            <strong>
              {customer.name || customer.customerCode || 'Não identificado'}
              {customer.document ? ` · ${customer.document}` : ''}
              {customer.plate ? ` · ${customer.plate}` : ''}
              {customer.km ? ` · KM ${customer.km}` : ''}
            </strong>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-compact"
            onClick={() => {
              setStep('cliente')
            }}
          >
            Identificar cliente
          </button>
        </div>

        <div className="discount-coupon-row">
          <label className="discount-coupon-field" htmlFor="discount-coupon-code">
            <span>Código cupom desconto</span>
            <input
              id="discount-coupon-code"
              value={discountCouponCode}
              disabled={tefBusy || consultingDiscountCoupon}
              onChange={(e) => {
                setDiscountCouponCode(e.target.value)
                setDiscountCouponLabel(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void consultarCupomDesconto()
                }
              }}
              placeholder="Informe o código"
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            className="btn btn-secondary btn-compact"
            disabled={tefBusy || consultingDiscountCoupon}
            onClick={() => void consultarCupomDesconto()}
          >
            {consultingDiscountCoupon ? '…' : 'Consultar'}
          </button>
          {discountCouponLabel ? (
            <span className="discount-coupon-ok">Cupom {discountCouponLabel}</span>
          ) : null}
        </div>

        <div className="pay-method-grid">
          <div className="pay-method-grid-head">
            <span>Documento</span>
            <span>Valor</span>
          </div>
          {paymentMethods.map((m) => (
            <div key={m.id} className="pay-method-grid-row">
              <span className="pay-method-grid-label">{m.label}</span>
              <input
                className="pay-method-grid-input"
                inputMode="decimal"
                placeholder="0,00"
                value={methodInputs[m.id] ?? ''}
                disabled={tefBusy}
                onChange={(e) => setMethodInput(m.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addDocumentFromInput(m.id)
                  }
                }}
              />
            </div>
          ))}
          <p className="pay-method-hint">
            Digite o valor e pressione <strong>Enter</strong>. Se estiver zerado, assume o restante (
            {formatCurrency(remaining)}). <strong>TEF</strong> abre o menu de vendas no SiTef.{' '}
            <strong>Cartão POS</strong> não usa SiTef — escolha a bandeira da máquina.
          </p>
        </div>

        {posPopup ? (
          <div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pos-card-title"
            onClick={() => setPosPopup(null)}
          >
            <div
              className="modal-card pos-card-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="pos-card-title">Cartão POS</h2>
              <p className="pos-card-amount">
                Valor: <strong>{formatCurrency(posPopup.amount)}</strong>
              </p>
              <p className="pos-card-hint">Selecione a bandeira / produto da máquina POS:</p>
              <div className="pos-card-grid">
                {posCardOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className="btn btn-secondary pos-card-option"
                    onClick={() => confirmarCartaoPos(opt.id, opt.label)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-block"
                style={{ marginTop: 12 }}
                onClick={() => setPosPopup(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel pay-panel pay-receive">
        <div className="panel-header panel-header-compact">
          <h2>Recebimento</h2>
        </div>
        <div className="amount-box pay-summary">
          <div className="pay-summary-title">Resumo</div>
          <div className="pay-summary-rows">
            <div className="pay-summary-row">
              <span>Total</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>
            <div className="pay-summary-row pay-summary-discount">
              <span>Desconto</span>
              <strong>−{formatCurrency(discountTotal)}</strong>
            </div>
            <div className="pay-summary-row pay-summary-net">
              <span>Total com desconto</span>
              <strong>{formatCurrency(total)}</strong>
            </div>
            <div className="pay-summary-row pay-summary-meta">
              <span>Documentos</span>
              <strong>{formatCurrency(paidTotal)}</strong>
            </div>
            <div className="pay-summary-row pay-summary-meta">
              <span>Restante</span>
              <strong>{formatCurrency(remaining)}</strong>
            </div>
            {cashChange > 0 ? (
              <div className="pay-summary-row pay-summary-meta">
                <span>Troco</span>
                <strong>{formatCurrency(cashChange)}</strong>
              </div>
            ) : null}
          </div>
        </div>

        <div className="pay-docs pay-docs-receive">
          <div className="panel-header panel-header-compact">
            <h2>Documentos da venda</h2>
          </div>
          {payLines.length === 0 ? (
            <div className="empty" style={{ padding: 16 }}>
              Nenhum documento lançado.
            </div>
          ) : (
            <div className="pay-docs-list">
              {payLines.map((line, index) => (
                <button
                  key={line.id}
                  type="button"
                  className={`pay-doc-row${selectedLineId === line.id ? ' selected' : ''}`}
                  onClick={() => selectLine(line.id)}
                >
                  <span className="pay-doc-idx">{index + 1}</span>
                  <span className="pay-doc-main">
                    <strong>{methodLabel(line.methodId, line.detail)}</strong>
                    <span>
                      {line.status === 'approved'
                        ? 'Ok'
                        : line.status === 'error'
                          ? 'Erro'
                          : isTefMethodId(line.methodId)
                            ? line.methodId === 'tef'
                              ? 'Aguardando menu TEF'
                              : 'Aguardando TEF'
                            : 'Lançado'}
                    </span>
                  </span>
                  <strong className="pay-doc-amount">{formatCurrency(line.amount)}</strong>
                  <span
                    className="pay-doc-remove"
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      removeDocument(line.id)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        removeDocument(line.id)
                      }
                    }}
                  >
                    ✕
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pay-cart pay-cart-receive">
          <div className="panel-header panel-header-compact">
            <h2>Itens do cupom</h2>
          </div>
          <div className="pay-cart-list">
            {cart.map((item) => (
              <div key={item.id} className="pay-cart-item">
                <span>
                  {item.name} ({item.qty} {item.unit})
                  {(item.discount ?? 0) > 0 ? (
                    <em className="pay-cart-item-discount">
                      {' '}
                      −{formatCurrency(item.discount ?? 0)}
                    </em>
                  ) : null}
                </span>
                <strong>{formatCurrency(lineNetTotal(item))}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="pay-actions">
          <button
            type="button"
            className="btn btn-danger btn-block"
            onClick={() => void cancelarTefEVoltar()}
            disabled={tefBusy}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => void fecharVenda()}
            disabled={tefBusy || fiscalBusy}
          >
            {fiscalBusy ? 'Emitindo nota…' : 'Fechar venda'}
          </button>
        </div>
      </section>

      {consultingDiscountCoupon ? (
        <div
          className="wait-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cupom-wait-title"
        >
          <div className="wait-card">
            <div className="wait-spinner" aria-hidden />
            <h2 id="cupom-wait-title">Pesquisando cupom</h2>
            <p>PESQUISANDO CUPOM, AGUARDE...</p>
          </div>
        </div>
      ) : null}

      {tefSession ? (
        <div className="tef-overlay" role="dialog" aria-modal="true" aria-labelledby="tef-title">
          <div
            className={`tef-card${
              tefSession.state?.status === 'waiting_menu' && tefSession.state.menuOptions?.length
                ? ' tef-card--menu'
                : ''
            }`}
          >
            <div className="tef-card-top">
              <span className="tef-step">
                TEF {tefSession.index}/{tefSession.total}
              </span>
              <span className="tef-method">{methodLabel(tefSession.methodId)}</span>
            </div>

            {!(
              tefSession.state?.status === 'waiting_menu' && tefSession.state.menuOptions?.length
            ) ? (
              <div
                className={`tef-status-orb ${
                  tefSession.error
                    ? 'error'
                    : tefSession.state?.status === 'approved'
                      ? 'ok'
                      : 'pulse'
                }`}
                aria-hidden
              />
            ) : null}

            <h2 id="tef-title">{tefHeadline(tefSession.state, tefSession.methodId)}</h2>
            <p className="tef-detail">{tefSession.error || tefDetail(tefSession.state)}</p>

            <div className="tef-amount">{formatCurrency(tefSession.amount)}</div>

            {tefSession.state?.status === 'waiting_menu' && tefSession.state.menuOptions?.length ? (
              <div className="tef-menu">
                <p className="tef-menu-title">
                  {tefSession.state.menuTitle || 'Forma de pagamento'}
                </p>
                <div className="tef-menu-grid">
                  {tefSession.state.menuOptions.map((opt) => (
                    <button
                      key={opt.code}
                      type="button"
                      className="btn btn-secondary tef-menu-option"
                      onClick={() => void enviarEntradaTef(opt.code)}
                    >
                      <span className="tef-menu-code" aria-hidden>
                        {opt.code}
                      </span>
                      <span className="tef-menu-label">{opt.label}</span>
                    </button>
                  ))}
                </div>
                <p className="tef-menu-hint">Digite o número no teclado para escolher a opção.</p>
              </div>
            ) : null}

            {tefSession.state?.status === 'waiting_confirm' ? (
              <div className="tef-confirm-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  onClick={() => void enviarEntradaTef('0')}
                >
                  Sim
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-lg"
                  onClick={() => void enviarEntradaTef('1')}
                >
                  Não
                </button>
              </div>
            ) : null}

            {tefSession.state?.status === 'waiting_field' && tefSession.state.fieldPrompt ? (
              <form
                className="tef-field-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  const raw = tefFieldInput.trim()
                  const min = tefSession.state?.fieldPrompt?.minLength ?? 0
                  if (min > 0 && raw.length < min) {
                    showAlert({
                      title: 'TEF',
                      message: `Informe pelo menos ${min} caractere(s).`,
                    })
                    return
                  }
                  void enviarEntradaTef(raw)
                }}
              >
                <label className="tef-field-label" htmlFor="tef-field-input">
                  {tefSession.state.fieldPrompt.prompt}
                </label>
                <input
                  id="tef-field-input"
                  className="tef-field-input"
                  autoFocus
                  inputMode={
                    tefSession.state.fieldPrompt.inputMode === 'currency'
                      ? 'decimal'
                      : tefSession.state.fieldPrompt.inputMode === 'number'
                        ? 'numeric'
                        : 'text'
                  }
                  maxLength={
                    tefSession.state.fieldPrompt.maxLength > 0
                      ? tefSession.state.fieldPrompt.maxLength
                      : undefined
                  }
                  placeholder={
                    tefSession.state.fieldPrompt.inputMode === 'currency'
                      ? '0,00'
                      : tefSession.state.fieldPrompt.inputMode === 'number'
                        ? 'Ex.: 3'
                        : ''
                  }
                  value={tefFieldInput}
                  onChange={(e) => setTefFieldInput(e.target.value)}
                />
                <button type="submit" className="btn btn-primary btn-lg btn-block">
                  Confirmar
                </button>
              </form>
            ) : null}

            {tefSession.state?.status === 'waiting_key' ? (
              <button
                type="button"
                className="btn btn-primary btn-lg btn-block"
                onClick={() => void enviarEntradaTef('')}
              >
                OK
              </button>
            ) : null}

            {tefSession.state?.pixQrPayload ? (
              <div className="tef-qr">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(tefSession.state.pixQrPayload)}`}
                  alt="QR Code PIX"
                  width={200}
                  height={200}
                />
                <span>Escaneie o QR no app do banco</span>
              </div>
            ) : null}

            {tefSession.state?.status === 'approved' && (tefSession.state.nsu || tefSession.state.authorizationCode) ? (
              <div className="tef-receipt-meta">
                {[
                  tefSession.state.brand,
                  tefSession.state.nsu ? `NSU ${tefSession.state.nsu}` : null,
                  tefSession.state.authorizationCode ? `AUT ${tefSession.state.authorizationCode}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            ) : null}

            {tefSession.error ? (
              <button
                type="button"
                className="btn btn-secondary btn-lg"
                onClick={() => {
                  setTefSession(null)
                  setTefBusy(false)
                }}
              >
                Voltar aos documentos
              </button>
            ) : (
              <div className="tef-actions">
                {tefSession.state?.status === 'waiting_menu' ||
                tefSession.state?.status === 'waiting_field' ||
                tefSession.state?.status === 'waiting_confirm' ||
                tefSession.state?.status === 'waiting_key' ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void voltarEtapaTef()}
                  >
                    Voltar
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void pedirCancelamentoTef()}
                >
                  Cancelar TEF
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
