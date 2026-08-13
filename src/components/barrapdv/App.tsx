import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { VendaPage } from './pages/VendaPage'
import { PagamentoPage } from './pages/PagamentoPage'
import { ProdutosPage } from './pages/ProdutosPage'
import { CaixaPage } from './pages/CaixaPage'
import { RelatoriosPage } from './pages/RelatoriosPage'
import { ConfigPage } from './pages/ConfigPage'
import { AdmPage } from './pages/AdmPage'
import { CancelamentoPage } from './pages/CancelamentoPage'
import { AbastecidasPage } from './pages/AbastecidasPage'
import { ReimpressaoPage } from './pages/ReimpressaoPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/venda" replace />} />
      <Route element={<AppShell />}>
        <Route path="/venda" element={<VendaPage />} />
        <Route path="/produtos" element={<ProdutosPage />} />
        <Route path="/pagamento" element={<PagamentoPage />} />
        <Route path="/abastecidas" element={<AbastecidasPage />} />
        <Route path="/cancelamento" element={<CancelamentoPage />} />
        <Route path="/adm" element={<AdmPage />} />
        <Route path="/caixa" element={<CaixaPage />} />
        <Route path="/relatorios" element={<RelatoriosPage />} />
        <Route path="/reimpressao" element={<ReimpressaoPage />} />
        <Route path="/config" element={<ConfigPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
