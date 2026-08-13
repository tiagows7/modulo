import { useNavigate } from 'react-router-dom'

export function AdmBackButton() {
  const navigate = useNavigate()

  return (
    <div className="adm-back-row">
      <button type="button" className="btn btn-secondary" onClick={() => navigate('/adm')}>
        ← Voltar
      </button>
    </div>
  )
}
