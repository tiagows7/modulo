import { AdmBackButton } from '../components/AdmBackButton'
import { CBC_CONFIG } from '../services/concentrador/config'
import { usePdvModo } from '../hooks/usePdvModo'
import { PDV_MODO_LABEL, type PdvModo } from '../config/pdvConfig'

export function ConfigPage() {
  const { modo, setModo, label } = usePdvModo()

  return (
    <div>
      <AdmBackButton />
      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <h2>Configurações do PDV</h2>
          <span className="chip">{label}</span>
        </div>
        <div style={{ padding: 16 }}>
          <div className="settings-grid">
            <div className="settings-item">
              <h3>Modelo do PDV</h3>
              <p style={{ marginBottom: 10 }}>
                Escolha o tipo de operação. O modo <strong>loja</strong> remove
                combustível e o concentrador CBC.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(
                  [
                    ['posto', PDV_MODO_LABEL.posto],
                    ['loja', PDV_MODO_LABEL.loja],
                  ] as const
                ).map(([value, text]) => (
                  <button
                    key={value}
                    type="button"
                    className={`btn ${modo === value ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setModo(value as PdvModo)}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-item">
              <h3>Identificação</h3>
              <p>Posto Horizonte · CNPJ 00.000.000/0001-00 · Razão social exemplo</p>
            </div>
            {modo === 'posto' ? (
              <div className="settings-item">
                <h3>Concentrador Companytec CBC</h3>
                <p>
                  Modo: <strong>{CBC_CONFIG.mode.toUpperCase()}</strong> · IP:{' '}
                  <strong>{CBC_CONFIG.host}</strong> · Porta: <strong>{CBC_CONFIG.port}</strong>
                  <br />
                  No PC do posto rode <code>npm run posto:autostart</code> uma vez
                  (sobe CBC/TEF/Fiscal/SmartPOS ao logar no Windows). Depois abra o PDV no
                  Vercel neste mesmo PC — sem precisar digitar comando todo dia.
                  <br />
                  Checklist: <code>docs/POSTO.md</code>
                </p>
              </div>
            ) : (
              <div className="settings-item">
                <h3>Concentrador CBC</h3>
                <p>
                  Desligado no modo loja. A venda usa apenas produtos de conveniência
                  (cupom + pagamento/TEF/NFC-e).
                </p>
              </div>
            )}
            <div className="settings-item">
              <h3>TEF CliSiTef64</h3>
              <p>
                Débito, crédito e PIX via ponte local (<code>npm run posto</code> ou{' '}
                <code>npm run tef-bridge</code> → <code>127.0.0.1:39101</code>).
              </p>
            </div>
            <div className="settings-item">
              <h3>Tela cheia (PDV)</h3>
              <p>
                O PDV entra em tela cheia automaticamente ao abrir.{' '}
                <strong>Esc</strong> sai da tela cheia.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
