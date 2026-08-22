import { AdmBackButton } from '../components/AdmBackButton'
import { CBC_CONFIG } from '../services/concentrador/config'

export function ConfigPage() {
  return (
    <div>
      <AdmBackButton />
      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <h2>Configurações do posto</h2>
          <span className="chip warn">Sem banco — tabela temporária CBC</span>
        </div>
        <div style={{ padding: 16 }}>
          <div className="settings-grid">
            <div className="settings-item">
              <h3>Identificação</h3>
              <p>Posto Horizonte · CNPJ 00.000.000/0001-00 · Razão social exemplo</p>
            </div>
            <div className="settings-item">
              <h3>Concentrador Companytec CBC</h3>
              <p>
                Modo: <strong>{CBC_CONFIG.mode.toUpperCase()}</strong> · IP:{' '}
                <strong>{CBC_CONFIG.host}</strong> · Porta: <strong>{CBC_CONFIG.port}</strong>
                <br />
                No PC do posto rode <code>npm run posto</code> (sobe CBC/TEF/Fiscal/SmartPOS).
                Se aparecer offline, o concentrador não está aceitando TCP nesse endereço.
                <br />
                Checklist: <code>docs/POSTO.md</code>
              </p>
            </div>
            <div className="settings-item">
              <h3>Preços</h3>
              <p>Tabela de combustíveis editável na próxima etapa</p>
            </div>
            <div className="settings-item">
              <h3>TEF CliSiTef64</h3>
              <p>
                Débito, crédito e PIX via ponte local (<code>npm run posto</code> ou{' '}
                <code>npm run tef-bridge</code> → <code>127.0.0.1:39101</code>). DLLs em{' '}
                <code>server/clisitef64/</code> (
                <code>CliSiTef64I.dll</code> do pacote Win64/Simulado). Modo atual no front:{' '}
                <strong>live</strong>. Para mock: <code>TEF_MODE=mock</code> na ponte e{' '}
                <code>mode: &apos;mock&apos;</code> em <code>src/services/tef/config.ts</code>.
              </p>
            </div>
            <div className="settings-item">
              <h3>Operadores</h3>
              <p>Carlos Silva, Ana Souza — perfis e PINs mockados</p>
            </div>
            <div className="settings-item">
              <h3>Tela cheia (PDV)</h3>
              <p>
                O PDV entra em tela cheia automaticamente ao abrir (sem barra do Windows).{' '}
                <strong>Esc</strong> sai da tela cheia.
              </p>
            </div>
            <div className="settings-item">
              <h3>Instalação Windows</h3>
              <p>
                Instale como app (Chrome/Edge → Instalar aplicativo). O PWA abre em modo{' '}
                <strong>fullscreen</strong>.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
