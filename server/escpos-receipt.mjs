/**
 * Monta buffer ESC/POS a partir do texto do cupom (estilo ACBr DANFeESCPOS).
 * Compatível com Elgin i8 e demais térmicas ESC/POS 80mm.
 *
 * QR + tributos: uma única imagem (QR esquerda, texto menor à direita).
 */
import QRCode from 'qrcode'

/** Mapa PT-BR → CP850 (chaves em unicode escape). */
const CP850 = new Map([
  ['\u00C7', 0x80],
  ['\u00FC', 0x81],
  ['\u00E9', 0x82],
  ['\u00E2', 0x83],
  ['\u00E4', 0x84],
  ['\u00E0', 0x85],
  ['\u00E5', 0x86],
  ['\u00E7', 0x87],
  ['\u00EA', 0x88],
  ['\u00EB', 0x89],
  ['\u00E8', 0x8a],
  ['\u00EF', 0x8b],
  ['\u00EE', 0x8c],
  ['\u00EC', 0x8d],
  ['\u00C4', 0x8e],
  ['\u00C5', 0x8f],
  ['\u00C9', 0x90],
  ['\u00F4', 0x93],
  ['\u00F6', 0x94],
  ['\u00F2', 0x95],
  ['\u00FB', 0x96],
  ['\u00F9', 0x97],
  ['\u00D6', 0x99],
  ['\u00DC', 0x9a],
  ['\u00E1', 0xa0],
  ['\u00ED', 0xa1],
  ['\u00F3', 0xa2],
  ['\u00FA', 0xa3],
  ['\u00F1', 0xa4],
  ['\u00D1', 0xa5],
  ['\u00AA', 0xa6],
  ['\u00BA', 0xa7],
  ['\u00C1', 0xb5],
  ['\u00C2', 0xb6],
  ['\u00C0', 0xb7],
  ['\u00E3', 0xc6],
  ['\u00C3', 0xc7],
  ['\u00CA', 0xd2],
  ['\u00CB', 0xd3],
  ['\u00C8', 0xd4],
  ['\u00CD', 0xd6],
  ['\u00CE', 0xd7],
  ['\u00CF', 0xd8],
  ['\u00D3', 0xe0],
  ['\u00D4', 0xe2],
  ['\u00D2', 0xe3],
  ['\u00F5', 0xe4],
  ['\u00D5', 0xe5],
  ['\u00DA', 0xe9],
  ['\u00DB', 0xea],
  ['\u00D9', 0xeb],
])

/**
 * Fonte bitmap 5x7 (linhas = bits colunas 0..4).
 * Cobertura ASCII usada no cupom de tributos.
 */
const FONT5X7 = {
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x18, 0x18],
  ',': [0x00, 0x00, 0x00, 0x00, 0x18, 0x18, 0x30],
  ':': [0x00, 0x18, 0x18, 0x00, 0x18, 0x18, 0x00],
  '-': [0x00, 0x00, 0x00, 0x3e, 0x00, 0x00, 0x00],
  '/': [0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x00],
  '(': [0x0c, 0x10, 0x20, 0x20, 0x20, 0x10, 0x0c],
  ')': [0x30, 0x08, 0x04, 0x04, 0x04, 0x08, 0x30],
  '$': [0x08, 0x3e, 0x48, 0x3e, 0x09, 0x3e, 0x08],
  '0': [0x1c, 0x22, 0x26, 0x2a, 0x32, 0x22, 0x1c],
  '1': [0x08, 0x18, 0x08, 0x08, 0x08, 0x08, 0x1c],
  '2': [0x1c, 0x22, 0x02, 0x0c, 0x10, 0x20, 0x3e],
  '3': [0x1c, 0x22, 0x02, 0x0c, 0x02, 0x22, 0x1c],
  '4': [0x04, 0x0c, 0x14, 0x24, 0x3e, 0x04, 0x04],
  '5': [0x3e, 0x20, 0x3c, 0x02, 0x02, 0x22, 0x1c],
  '6': [0x0c, 0x10, 0x20, 0x3c, 0x22, 0x22, 0x1c],
  '7': [0x3e, 0x02, 0x04, 0x08, 0x10, 0x10, 0x10],
  '8': [0x1c, 0x22, 0x22, 0x1c, 0x22, 0x22, 0x1c],
  '9': [0x1c, 0x22, 0x22, 0x1e, 0x02, 0x04, 0x18],
  A: [0x1c, 0x22, 0x22, 0x3e, 0x22, 0x22, 0x22],
  B: [0x3c, 0x22, 0x22, 0x3c, 0x22, 0x22, 0x3c],
  C: [0x1c, 0x22, 0x20, 0x20, 0x20, 0x22, 0x1c],
  D: [0x3c, 0x22, 0x22, 0x22, 0x22, 0x22, 0x3c],
  E: [0x3e, 0x20, 0x20, 0x3c, 0x20, 0x20, 0x3e],
  F: [0x3e, 0x20, 0x20, 0x3c, 0x20, 0x20, 0x20],
  G: [0x1c, 0x22, 0x20, 0x2e, 0x22, 0x22, 0x1c],
  H: [0x22, 0x22, 0x22, 0x3e, 0x22, 0x22, 0x22],
  I: [0x1c, 0x08, 0x08, 0x08, 0x08, 0x08, 0x1c],
  J: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x24, 0x18],
  L: [0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x3e],
  M: [0x22, 0x36, 0x2a, 0x2a, 0x22, 0x22, 0x22],
  N: [0x22, 0x32, 0x2a, 0x26, 0x22, 0x22, 0x22],
  O: [0x1c, 0x22, 0x22, 0x22, 0x22, 0x22, 0x1c],
  P: [0x3c, 0x22, 0x22, 0x3c, 0x20, 0x20, 0x20],
  R: [0x3c, 0x22, 0x22, 0x3c, 0x28, 0x24, 0x22],
  S: [0x1c, 0x22, 0x20, 0x1c, 0x02, 0x22, 0x1c],
  T: [0x3e, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08],
  U: [0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x1c],
  V: [0x22, 0x22, 0x22, 0x22, 0x22, 0x14, 0x08],
  X: [0x22, 0x22, 0x14, 0x08, 0x14, 0x22, 0x22],
  Y: [0x22, 0x22, 0x14, 0x08, 0x08, 0x08, 0x08],
  a: [0x00, 0x00, 0x1c, 0x02, 0x1e, 0x22, 0x1e],
  b: [0x20, 0x20, 0x3c, 0x22, 0x22, 0x22, 0x3c],
  c: [0x00, 0x00, 0x1c, 0x20, 0x20, 0x20, 0x1c],
  d: [0x02, 0x02, 0x1e, 0x22, 0x22, 0x22, 0x1e],
  e: [0x00, 0x00, 0x1c, 0x22, 0x3e, 0x20, 0x1c],
  f: [0x0c, 0x10, 0x10, 0x3c, 0x10, 0x10, 0x10],
  i: [0x08, 0x00, 0x18, 0x08, 0x08, 0x08, 0x1c],
  l: [0x18, 0x08, 0x08, 0x08, 0x08, 0x08, 0x1c],
  m: [0x00, 0x00, 0x34, 0x2a, 0x2a, 0x2a, 0x22],
  n: [0x00, 0x00, 0x2c, 0x32, 0x22, 0x22, 0x22],
  o: [0x00, 0x00, 0x1c, 0x22, 0x22, 0x22, 0x1c],
  p: [0x00, 0x00, 0x3c, 0x22, 0x22, 0x3c, 0x20],
  r: [0x00, 0x00, 0x2c, 0x32, 0x20, 0x20, 0x20],
  s: [0x00, 0x00, 0x1e, 0x20, 0x1c, 0x02, 0x3c],
  t: [0x10, 0x10, 0x3c, 0x10, 0x10, 0x10, 0x0c],
  u: [0x00, 0x00, 0x22, 0x22, 0x22, 0x26, 0x1a],
  v: [0x00, 0x00, 0x22, 0x22, 0x22, 0x14, 0x08],
  x: [0x00, 0x00, 0x22, 0x14, 0x08, 0x14, 0x22],
}

const ACCENT_FOLD = {
  '\u00E1': 'a',
  '\u00E0': 'a',
  '\u00E3': 'a',
  '\u00E2': 'a',
  '\u00E9': 'e',
  '\u00EA': 'e',
  '\u00ED': 'i',
  '\u00F3': 'o',
  '\u00F4': 'o',
  '\u00F5': 'o',
  '\u00FA': 'u',
  '\u00E7': 'c',
  '\u00C7': 'C',
  '\u00C1': 'A',
  '\u00C9': 'E',
  '\u00CD': 'I',
  '\u00D3': 'O',
  '\u00DA': 'U',
}

/**
 * @param {string} text
 * @returns {Buffer}
 */
function encodeCp850(text) {
  const bytes = []
  for (const ch of String(text || '')) {
    const code = ch.codePointAt(0) ?? 63
    if (code <= 0x7f) {
      bytes.push(code)
      continue
    }
    const mapped = CP850.get(ch)
    bytes.push(mapped != null ? mapped : 0x3f)
  }
  return Buffer.from(bytes)
}

/**
 * @param {boolean[][]} pixels
 * @param {number} x
 * @param {number} y
 */
function setPixel(pixels, x, y) {
  if (y < 0 || y >= pixels.length) return
  if (x < 0 || x >= pixels[0].length) return
  pixels[y][x] = true
}

/**
 * @param {boolean[][]} pixels
 * @param {string} text
 * @param {number} x0
 * @param {number} y0
 * @param {number} [scale]
 */
function drawText5x7(pixels, text, x0, y0, scale = 1) {
  const s = Math.max(1, scale | 0)
  let x = x0
  for (const raw of text) {
    const ch = ACCENT_FOLD[raw] || raw
    const glyph = FONT5X7[ch] || FONT5X7[ch.toUpperCase()] || FONT5X7['.']
    for (let row = 0; row < 7; row++) {
      const bits = glyph[row]
      for (let col = 0; col < 5; col++) {
        if (!(bits & (0x10 >> col))) continue
        for (let dy = 0; dy < s; dy++) {
          for (let dx = 0; dx < s; dx++) {
            setPixel(pixels, x + col * s + dx, y0 + row * s + dy)
          }
        }
      }
    }
    x += 6 * s // 5px + 1 gap, escalado
  }
}

/**
 * @param {boolean[][]} pixels
 * @returns {Buffer} ESC/POS GS v 0
 */
function pixelsToRaster(pixels) {
  const height = pixels.length
  const width = pixels[0]?.length || 0
  if (!width || !height) return Buffer.alloc(0)

  const widthBytes = Math.ceil(width / 8)
  const data = Buffer.alloc(widthBytes * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!pixels[y][x]) continue
      const byteIndex = y * widthBytes + (x >> 3)
      data[byteIndex] |= 0x80 >> (x & 7)
    }
  }

  return Buffer.concat([
    Buffer.from([
      0x1d,
      0x76,
      0x30,
      0x00,
      widthBytes & 0xff,
      (widthBytes >> 8) & 0xff,
      height & 0xff,
      (height >> 8) & 0xff,
    ]),
    data,
  ])
}

/**
 * QR à esquerda + tributos à direita (letra menor), numa única imagem.
 * @param {string} qrPayload
 * @param {string[]} besideLines
 * @returns {Buffer}
 */
function buildQrBesideBlock(qrPayload, besideLines) {
  const lines = besideLines.map((l) => String(l || '').trim()).filter(Boolean)
  const value = String(qrPayload || '')
  if (!value) {
    return Buffer.concat(lines.flatMap((l) => [encodeCp850(l), Buffer.from([0x0a])]))
  }

  let qr
  try {
    qr = QRCode.create(value, { errorCorrectionLevel: 'M' })
  } catch {
    return Buffer.concat(lines.flatMap((l) => [encodeCp850(l), Buffer.from([0x0a])]))
  }

  const modules = qr.modules
  const modSize = modules.size
  const scale = 2 // QR compacto para sobrar espaço ao texto
  const qrPx = modSize * scale
  const gap = 10
  const paperDots = 576 // ~80mm @ 203dpi
  const textAreaW = Math.max(120, paperDots - qrPx - gap)
  const fontScale = 2 // letra maior ao lado do QR
  const charW = 6 * fontScale
  const lineH = 10 * fontScale
  const maxChars = Math.floor(textAreaW / charW)

  // Quebra linhas longas
  const wrapped = []
  for (const line of lines) {
    let rest = line
    while (rest.length > maxChars) {
      wrapped.push(rest.slice(0, maxChars))
      rest = rest.slice(maxChars)
    }
    if (rest) wrapped.push(rest)
  }

  const textH = wrapped.length * lineH + 2
  const width = Math.min(paperDots, qrPx + gap + textAreaW)
  const height = Math.max(qrPx, textH)

  /** @type {boolean[][]} */
  const pixels = Array.from({ length: height }, () => Array(width).fill(false))

  // QR esquerda
  for (let y = 0; y < modSize; y++) {
    for (let x = 0; x < modSize; x++) {
      const dark = typeof modules.get === 'function' ? modules.get(x, y) : modules[y * modSize + x]
      if (!dark) continue
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          setPixel(pixels, x * scale + dx, y * scale + dy)
        }
      }
    }
  }

  // Texto à direita
  const textX = qrPx + gap
  const textY = Math.max(0, Math.floor((qrPx - textH) / 2))
  for (let i = 0; i < wrapped.length; i++) {
    drawText5x7(pixels, wrapped[i], textX, textY + i * lineH, fontScale)
  }

  const raster = pixelsToRaster(pixels)
  return Buffer.concat([Buffer.from([0x1b, 0x61, 0x00]), raster, Buffer.from([0x0a])])
}

/**
 * @param {string} payload
 * @param {number} [scale]
 * @returns {Buffer}
 */
function buildQrRaster(payload, scale = 2) {
  const value = String(payload || '')
  if (!value) return Buffer.alloc(0)
  let qr
  try {
    qr = QRCode.create(value, { errorCorrectionLevel: 'M' })
  } catch {
    return Buffer.alloc(0)
  }
  const modules = qr.modules
  const size = modules.size
  const width = size * scale
  const height = size * scale
  /** @type {boolean[][]} */
  const pixels = Array.from({ length: height }, () => Array(width).fill(false))
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dark = typeof modules.get === 'function' ? modules.get(x, y) : modules[y * size + x]
      if (!dark) continue
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          setPixel(pixels, x * scale + dx, y * scale + dy)
        }
      }
    }
  }
  return pixelsToRaster(pixels)
}

/**
 * @param {{
 *   text: string
 *   qrPayload?: string
 *   cut?: boolean
 * }} options
 * @returns {Buffer}
 */
export function buildEscPosReceipt(options) {
  const text = String(options.text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const parts = []
  const qrPayload = options.qrPayload ? String(options.qrPayload) : ''
  let qrEmbedded = false

  parts.push(Buffer.from([0x1b, 0x40]))
  parts.push(Buffer.from([0x1b, 0x74, 0x02]))
  parts.push(Buffer.from([0x1b, 0x61, 0x00]))

  const rawLines = text.split('\n')
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trimEnd()

    if (line === '<<CENTER>>') {
      parts.push(Buffer.from([0x1b, 0x61, 0x01]))
      continue
    }
    if (line === '<<LEFT>>') {
      parts.push(Buffer.from([0x1b, 0x61, 0x00]))
      continue
    }
    if (line === '<<RIGHT>>') {
      parts.push(Buffer.from([0x1b, 0x61, 0x02]))
      continue
    }
    // Fonte B (menor) / Fonte A (normal) — ESC M
    if (line === '<<SMALL>>') {
      parts.push(Buffer.from([0x1b, 0x4d, 0x01]))
      continue
    }
    if (line === '<<NORMAL>>') {
      parts.push(Buffer.from([0x1b, 0x4d, 0x00]))
      continue
    }

    if (line === '<<QR_BESIDE>>') {
      const beside = []
      i += 1
      while (i < rawLines.length && rawLines[i].trimEnd() !== '<<END_QR_BESIDE>>') {
        beside.push(rawLines[i].trimEnd())
        i += 1
      }
      if (qrPayload) {
        parts.push(buildQrBesideBlock(qrPayload, beside))
        qrEmbedded = true
      } else {
        for (const bl of beside) {
          parts.push(encodeCp850(bl))
          parts.push(Buffer.from([0x0a]))
        }
      }
      continue
    }

    if (line === '<<END_QR_BESIDE>>' || line === '<<QR>>') {
      continue
    }

    parts.push(encodeCp850(line))
    parts.push(Buffer.from([0x0a]))
  }

  if (qrPayload && !qrEmbedded) {
    parts.push(Buffer.from([0x0a]))
    parts.push(Buffer.from([0x1b, 0x61, 0x00]))
    const qr = buildQrRaster(qrPayload, 2)
    if (qr.length) {
      parts.push(qr)
      parts.push(Buffer.from([0x0a]))
    }
  }

  parts.push(Buffer.from([0x0a, 0x0a, 0x0a]))
  if (options.cut !== false) {
    parts.push(Buffer.from([0x1d, 0x56, 0x01]))
  }

  return Buffer.concat(parts)
}
