import { useState, type ReactNode } from 'react'
import { useCaixaStatus } from '../context/CaixaStatusContext'

/**
 * Bloqueia o PDV quando o último caixa está fechado (situacao = 1)
 * ou quando ainda não existe caixa aberto.
 */
export function CaixaStatusGuard({ children }: { children: ReactNode }) {
  const { status, caixa, error, abrirCaixa, abrindo, refresh } = useCaixaStatus()
  const [actionError, setActionError] = useState('')

  if (status === 'loading') {
    return (
      <div
        className="server-offline-overlay server-connecting-overlay"
        role="status"
        aria-live="polite"
      >
        <div className="server-offline-card">
          <div className="server-connecting-spinner" aria-hidden />
          <h2>Verificando caixa…</h2>
          <p>Consultando o último caixa gerado.</p>
        </div>
      </div>
    )
  }

  if (status === 'aberto') {
    return <>{children}</>
  }

  const handleAbrir = async () => {
    setActionError('')
    try {
      await abrirCaixa()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível abrir o caixa.')
    }
  }

  const msgErro = actionError || (status === 'erro' ? error : '')

  return (
    <div className="server-offline-overlay" role="alert" aria-live="assertive">
      <div className="server-offline-card">
        <div className="server-offline-icon" aria-hidden>
          ⛔
        </div>
        <h2>Caixa fechado</h2>
        <p>
          {caixa
            ? <>O último caixa (nº <strong>{caixa.codigo}</strong>) está fechado.</>
            : <>Não há caixa aberto no momento.</>}
          <br />
          Nenhuma operação do PDV pode ser feita até abrir um novo caixa.
        </p>
        {msgErro ? (
          <p className="caixa-guard-error">{msgErro}</p>
        ) : null}
        <div className="caixa-guard-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleAbrir()}
            disabled={abrindo}
          >
            {abrindo ? 'Abrindo…' : 'Abrir novo caixa'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void refresh()}
            disabled={abrindo}
          >
            Atualizar
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              window.location.href = '/'
            }}
            disabled={abrindo}
          >
            Sair do PDV
          </button>
        </div>
      </div>
    </div>
  )
}
