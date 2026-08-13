/** Controle de tela cheia do PDV (sem barra do Windows/navegador). */

type KeyboardLockNavigator = Navigator & {
  keyboard?: {
    lock: (keyCodes?: string[]) => Promise<void>
    unlock: () => void
  }
}

let fullscreenLocked = false
let reentering = false

export function isFullscreenActive(): boolean {
  return Boolean(document.fullscreenElement)
}

export async function enterFullscreen(el: Element = document.documentElement): Promise<boolean> {
  if (isFullscreenActive()) return true
  try {
    const anyEl = el as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void
      msRequestFullscreen?: () => Promise<void> | void
    }
    if (el.requestFullscreen) {
      await el.requestFullscreen()
    } else if (anyEl.webkitRequestFullscreen) {
      await anyEl.webkitRequestFullscreen()
    } else if (anyEl.msRequestFullscreen) {
      await anyEl.msRequestFullscreen()
    } else {
      return false
    }
    return true
  } catch {
    return false
  }
}

export async function exitFullscreen(options?: { force?: boolean }): Promise<void> {
  // Com trava ativa o PDV não sai de tela cheia (exceto force no login/sair).
  if ((!options?.force && fullscreenLocked) || !isFullscreenActive()) return
  try {
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void
      msExitFullscreen?: () => Promise<void> | void
    }
    if (document.exitFullscreen) {
      await document.exitFullscreen()
    } else if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen()
    } else if (doc.msExitFullscreen) {
      await doc.msExitFullscreen()
    }
  } catch {
    // ignorar
  }
}

export async function toggleFullscreen(): Promise<boolean> {
  if (fullscreenLocked) {
    return enterFullscreen()
  }
  if (isFullscreenActive()) {
    await exitFullscreen()
    return false
  }
  return enterFullscreen()
}

async function tryKeyboardLock(): Promise<void> {
  const keyboard = (navigator as KeyboardLockNavigator).keyboard
  if (!keyboard?.lock || !isFullscreenActive()) return
  try {
    // Chromium: impede Esc/F11 de sair da Fullscreen API (quando permitido).
    await keyboard.lock(['Escape', 'F11'])
  } catch {
    // API indisponível / sem permissão — fallback nos listeners abaixo.
  }
}

function unlockKeyboard(): void {
  try {
    ;(navigator as KeyboardLockNavigator).keyboard?.unlock()
  } catch {
    // ignorar
  }
}

function ensureFullscreen(): void {
  if (!fullscreenLocked || reentering || isFullscreenActive()) return
  reentering = true
  void enterFullscreen()
    .then(() => tryKeyboardLock())
    .finally(() => {
      reentering = false
    })
}

/**
 * Mantém o PDV em tela cheia: bloqueia Esc/F11 quando possível e
 * reentra automaticamente se o usuário sair.
 * Retorna cleanup para o useEffect.
 */
export function startFullscreenLock(): () => void {
  fullscreenLocked = true

  const onFullscreenChange = () => {
    if (!fullscreenLocked) return
    if (isFullscreenActive()) {
      void tryKeyboardLock()
      return
    }
    // Esc do browser encerra o fullscreen; reentra em seguida.
    window.setTimeout(() => ensureFullscreen(), 40)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (!fullscreenLocked) return
    if (event.key !== 'Escape' && event.key !== 'F11') return
    event.preventDefault()
    event.stopPropagation()
    if (!isFullscreenActive()) ensureFullscreen()
  }

  // 1º gesto: navegador só libera fullscreen após interação do usuário.
  const onFirstGesture = () => {
    ensureFullscreen()
    window.removeEventListener('pointerdown', onFirstGesture)
    window.removeEventListener('keydown', onFirstGesture)
  }

  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('webkitfullscreenchange', onFullscreenChange)
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('pointerdown', onFirstGesture, { once: true })
  window.addEventListener('keydown', onFirstGesture, { once: true })

  void enterFullscreen().then(() => tryKeyboardLock())

  return () => {
    fullscreenLocked = false
    document.removeEventListener('fullscreenchange', onFullscreenChange)
    document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
    window.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('pointerdown', onFirstGesture)
    window.removeEventListener('keydown', onFirstGesture)
    unlockKeyboard()
    void exitFullscreen({ force: true })
  }
}

const PREF_KEY = 'pdv_auto_fullscreen'

export function getAutoFullscreenPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === '1'
  } catch {
    return false
  }
}

export function setAutoFullscreenPref(enabled: boolean) {
  try {
    localStorage.setItem(PREF_KEY, enabled ? '1' : '0')
  } catch {
    // ignorar
  }
}
