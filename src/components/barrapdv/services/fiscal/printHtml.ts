/**
 * Impressão HTML confiável (evita falha do print() em iframe srcDoc).
 */
export async function printHtmlDocument(html: string): Promise<boolean> {
  const content = String(html || '').trim()
  if (!content) return false

  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('title', 'Impressão PDV')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none'

    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      window.setTimeout(() => {
        try {
          iframe.remove()
        } catch {
          /* ignore */
        }
      }, 1500)
      resolve(ok)
    }

    const runPrint = () => {
      try {
        const win = iframe.contentWindow
        if (!win) {
          finish(false)
          return
        }
        win.focus()
        win.print()
        finish(true)
      } catch {
        finish(false)
      }
    }

    const waitImagesThenPrint = () => {
      const doc = iframe.contentDocument
      if (!doc) {
        finish(false)
        return
      }
      const images = Array.from(doc.images)
      if (images.length === 0) {
        window.setTimeout(runPrint, 80)
        return
      }

      let pending = images.length
      let timedOut = false
      const timer = window.setTimeout(() => {
        timedOut = true
        runPrint()
      }, 4000)

      const oneDone = () => {
        if (timedOut || settled) return
        pending -= 1
        if (pending <= 0) {
          window.clearTimeout(timer)
          window.setTimeout(runPrint, 80)
        }
      }

      for (const img of images) {
        if (img.complete) {
          oneDone()
        } else {
          img.addEventListener('load', oneDone, { once: true })
          img.addEventListener('error', oneDone, { once: true })
        }
      }
    }

    iframe.addEventListener('load', () => {
      // srcdoc / write pode disparar load cedo demais em alguns browsers
      window.setTimeout(waitImagesThenPrint, 50)
    })

    document.body.appendChild(iframe)

    const doc = iframe.contentDocument
    if (!doc) {
      finish(false)
      return
    }

    doc.open()
    doc.write(content)
    doc.close()

    // Fallback se o evento load não disparar
    window.setTimeout(() => {
      if (!settled) waitImagesThenPrint()
    }, 600)
  })
}
