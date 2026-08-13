import { useEffect, useRef, useState, type ReactNode } from 'react'

const CHECK_INTERVAL_MS = 4000
const REQUEST_TIMEOUT_MS = 3500
/** Tentativas na abertura antes de mostrar “sem conexão”. */
const STARTUP_ATTEMPTS = 8
const STARTUP_GAP_MS = 1500

type ConnStatus = 'connecting' | 'online' | 'offline'

async function isServerReachable(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false
  }

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    // Health do gateway (:8765) — JSON { ok }. Se não existir, ping da origem.
    const health = await fetch(`${window.location.origin}/__pdv_health?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    })
    const ct = health.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      if (!health.ok) return false
      const body = (await health.json().catch(() => null)) as { ok?: boolean } | null
      return Boolean(body?.ok)
    }

    const response = await fetch(`${window.location.origin}/?health=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    window.clearTimeout(timer)
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

type Props = {
  children: ReactNode
}

export function ServerConnectionGuard({ children }: Props) {
  const [status, setStatus] = useState<ConnStatus>('connecting')
  const [attempt, setAttempt] = useState(0)
  const [retrying, setRetrying] = useState(false)
  const onlineRef = useRef(false)

  useEffect(() => {
    document.getElementById('pdv-boot-splash')?.remove()

    let cancelled = false
    let inFlight = false

    const checkOnce = async () => {
      if (inFlight) return null
      inFlight = true
      try {
        return await isServerReachable()
      } finally {
        inFlight = false
      }
    }

    const startup = async () => {
      setStatus('connecting')
      for (let i = 1; i <= STARTUP_ATTEMPTS; i++) {
        if (cancelled) return
        setAttempt(i)
        const ok = await checkOnce()
        if (cancelled) return
        if (ok) {
          onlineRef.current = true
          setStatus('online')
          return
        }
        if (i < STARTUP_ATTEMPTS) await sleep(STARTUP_GAP_MS)
      }
      if (!cancelled) {
        onlineRef.current = false
        setStatus('offline')
      }
    }

    const onOnline = () => {
      void (async () => {
        setStatus('connecting')
        const ok = await checkOnce()
        if (cancelled) return
        onlineRef.current = Boolean(ok)
        setStatus(ok ? 'online' : 'offline')
      })()
    }

    const onOffline = () => {
      onlineRef.current = false
      setStatus('offline')
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    void startup()

    const intervalId = window.setInterval(() => {
      void (async () => {
        const ok = await checkOnce()
        if (cancelled || ok == null) return
        if (ok) {
          if (!onlineRef.current) {
            onlineRef.current = true
            setStatus('online')
          }
        } else if (onlineRef.current) {
          onlineRef.current = false
          setStatus('offline')
        }
      })()
    }, CHECK_INTERVAL_MS)

    return () => {
      cancelled = true
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.clearInterval(intervalId)
    }
  }, [])

  const handleRetry = async () => {
    setRetrying(true)
    setStatus('connecting')
    setAttempt(0)
    try {
      for (let i = 1; i <= STARTUP_ATTEMPTS; i++) {
        setAttempt(i)
        const ok = await isServerReachable()
        if (ok) {
          onlineRef.current = true
          setStatus('online')
          window.location.reload()
          return
        }
        if (i < STARTUP_ATTEMPTS) await sleep(STARTUP_GAP_MS)
      }
      onlineRef.current = false
      setStatus('offline')
    } finally {
      setRetrying(false)
    }
  }

  if (status === 'connecting') {
    return (
      <div
        className="server-offline-overlay server-connecting-overlay"
        role="status"
        aria-live="polite"
      >
        <div className="server-offline-card">
          <div className="server-connecting-spinner" aria-hidden />
          <h2>Conectando ao servidor…</h2>
          <p>
            Aguarde enquanto o PDV verifica a comunicação com o servidor.
            {attempt > 0 ? (
              <>
                <br />
                Tentativa {attempt} de {STARTUP_ATTEMPTS}
              </>
            ) : null}
          </p>
        </div>
      </div>
    )
  }

  if (status === 'offline') {
    return (
      <div className="server-offline-overlay" role="alert" aria-live="assertive">
        <div className="server-offline-card">
          <div className="server-offline-icon" aria-hidden>
            ⚠
          </div>
          <h2>Sem conexão com o servidor</h2>
          <p>
            Não foi possível acessar o servidor do PDV. Verifique a rede e se o
            servidor está ligado, depois tente novamente.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleRetry()}
            disabled={retrying}
          >
            {retrying ? 'Conectando…' : 'Tentar novamente'}
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
