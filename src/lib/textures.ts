import {
  CanvasTexture,
  Color,
  LinearFilter,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three'
import type { MeshStandardMaterialParameters } from 'three'
import type { BodyCatalogEntry } from '../types'

const loader = new TextureLoader()
const textureCache = new Map<string, Texture>()

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function fillBands(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, colors: string[], random: () => number) {
  for (let band = 0; band < 20; band += 1) {
    const y = (band / 20) * canvas.height
    const height = canvas.height / 20 + random() * 10
    context.fillStyle = colors[band % colors.length]
    context.fillRect(0, y, canvas.width, height)
  }
}

function fillNoise(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  colors: string[],
  random: () => number,
  dotCount: number,
) {
  context.fillStyle = colors[0]
  context.fillRect(0, 0, canvas.width, canvas.height)
  for (let index = 0; index < dotCount; index += 1) {
    const x = random() * canvas.width
    const y = random() * canvas.height
    const radius = 1 + random() * 18
    context.fillStyle = colors[Math.floor(random() * colors.length)]
    context.globalAlpha = 0.15 + random() * 0.4
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fill()
  }
  context.globalAlpha = 1
}

function createProceduralTexture(body: BodyCatalogEntry): Texture {
  const seed = hashString(body.id)
  const random = createRandom(seed)
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Could not create a 2D drawing context for textures.')
  }

  const family = body.textureSet.textureFamily
  const baseColor = new Color(body.textureSet.colorHint)
  const lightColor = `#${baseColor.clone().offsetHSL(0, -0.03, 0.15).getHexString()}`
  const darkColor = `#${baseColor.clone().offsetHSL(0, 0.02, -0.18).getHexString()}`
  const accentColor = `#${baseColor.clone().offsetHSL(0.05, 0.06, 0.08).getHexString()}`

  if (family === 'sun') {
    const gradient = context.createRadialGradient(canvas.width / 2, canvas.height / 2, 40, canvas.width / 2, canvas.height / 2, canvas.width / 1.5)
    gradient.addColorStop(0, '#fff7c9')
    gradient.addColorStop(0.45, '#f3b348')
    gradient.addColorStop(1, '#8c3c06')
    context.fillStyle = gradient
    context.fillRect(0, 0, canvas.width, canvas.height)
    fillNoise(context, canvas, ['#ffefb7', '#f79f33', '#d44b16'], random, 2500)
  } else if (family.startsWith('gas-bands') || family.startsWith('ice-bands')) {
    const palette =
      family === 'gas-bands-warm'
        ? [lightColor, accentColor, darkColor, '#ece0c0', '#8c6d49']
        : family === 'gas-bands-pale'
          ? ['#ebe1c8', '#d8c59b', '#c4b08a', '#9f8a69', '#f6ebd1']
          : family === 'ice-bands-deep'
            ? ['#85b7ff', '#3a66c6', '#2a4190', '#9cdaf7', '#19306c']
            : ['#d0edf4', '#83d1df', '#68aebf', '#c4f1f5', '#7ad1dd']
    fillBands(context, canvas, palette, random)
    fillNoise(context, canvas, [lightColor, accentColor], random, 1100)
  } else if (family === 'earthlike') {
    context.fillStyle = '#1d4d84'
    context.fillRect(0, 0, canvas.width, canvas.height)
    fillNoise(context, canvas, ['#2a6db2', '#5ab1d1', '#2b5b8d'], random, 900)
    fillNoise(context, canvas, ['#568b3b', '#cbb87d', '#2b5f2b'], random, 800)
    fillNoise(context, canvas, ['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.18)'], random, 700)
  } else if (family === 'clouded-amber') {
    fillBands(context, canvas, ['#c48c43', '#dab868', '#9d6a35', '#f4df96'], random)
    fillNoise(context, canvas, ['rgba(255,255,255,0.22)', 'rgba(94,54,15,0.18)'], random, 1200)
  } else if (family === 'rust') {
    fillNoise(context, canvas, ['#5d2211', '#93462b', '#bb6a38', '#ddaa7a'], random, 2300)
  } else if (family === 'sulfuric') {
    fillNoise(context, canvas, ['#5b1200', '#f1a43d', '#edd25b', '#d9521f'], random, 2600)
  } else if (family.startsWith('icy')) {
    fillNoise(context, canvas, ['#eef5fb', '#d5e5f1', '#9eb9cb', '#c7d2db'], random, 2100)
    for (let index = 0; index < 180; index += 1) {
      context.strokeStyle = `rgba(120, 155, 180, ${0.08 + random() * 0.14})`
      context.lineWidth = 1 + random() * 2
      context.beginPath()
      context.moveTo(random() * canvas.width, random() * canvas.height)
      context.lineTo(random() * canvas.width, random() * canvas.height)
      context.stroke()
    }
  } else {
    fillNoise(context, canvas, [darkColor, accentColor, lightColor, body.textureSet.colorHint], random, 2300)
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.needsUpdate = true
  textureCache.set(body.id, texture)
  return texture
}

export function getBodyTexture(body: BodyCatalogEntry): Texture {
  const cached = textureCache.get(body.id)
  if (cached) {
    return cached
  }

  return createProceduralTexture(body)
}

export function warmCuratedTexture(body: BodyCatalogEntry, onLoaded: (texture: Texture) => void): void {
  if (!body.textureSet.curatedPath) {
    return
  }

  loader.load(
    body.textureSet.curatedPath,
    (texture: Texture) => {
      texture.colorSpace = SRGBColorSpace
      texture.minFilter = LinearFilter
      texture.magFilter = LinearFilter
      textureCache.set(body.id, texture)
      onLoaded(texture)
    },
    undefined,
    () => {
      /* Keep the procedural fallback if the curated texture fails. */
    },
  )
}

export function createBodyMaterial(body: BodyCatalogEntry): MeshStandardMaterial | MeshBasicMaterial {
  const texture = getBodyTexture(body)
  if (body.kind === 'sun') {
    return new MeshBasicMaterial({
      map: texture,
      color: 0xffffff,
    })
  }

  const config: MeshStandardMaterialParameters = {
    map: texture,
    roughness: body.kind === 'planet' ? 0.95 : 1,
    metalness: 0,
  }
  return new MeshStandardMaterial(config)
}

export function createRingTexture(textureFamily: string): Texture {
  const cacheKey = `ring:${textureFamily}`
  const cached = textureCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 32
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Could not create a 2D drawing context for ring textures.')
  }

  const gradient = context.createLinearGradient(0, 0, canvas.width, 0)
  if (textureFamily === 'rings-saturn') {
    gradient.addColorStop(0, 'rgba(235, 220, 186, 0)')
    gradient.addColorStop(0.15, 'rgba(200, 185, 145, 0.55)')
    gradient.addColorStop(0.5, 'rgba(250, 241, 214, 0.88)')
    gradient.addColorStop(0.8, 'rgba(189, 160, 119, 0.45)')
    gradient.addColorStop(1, 'rgba(235, 220, 186, 0)')
  } else if (textureFamily === 'rings-jupiter') {
    gradient.addColorStop(0, 'rgba(190, 170, 150, 0)')
    gradient.addColorStop(0.35, 'rgba(170, 150, 123, 0.2)')
    gradient.addColorStop(0.7, 'rgba(170, 150, 123, 0.12)')
    gradient.addColorStop(1, 'rgba(190, 170, 150, 0)')
  } else if (textureFamily === 'rings-uranus') {
    gradient.addColorStop(0, 'rgba(224, 247, 255, 0)')
    gradient.addColorStop(0.25, 'rgba(225, 244, 248, 0.18)')
    gradient.addColorStop(0.6, 'rgba(210, 240, 245, 0.42)')
    gradient.addColorStop(1, 'rgba(224, 247, 255, 0)')
  } else {
    gradient.addColorStop(0, 'rgba(163, 173, 209, 0)')
    gradient.addColorStop(0.35, 'rgba(153, 172, 214, 0.2)')
    gradient.addColorStop(0.72, 'rgba(150, 179, 228, 0.33)')
    gradient.addColorStop(1, 'rgba(163, 173, 209, 0)')
  }

  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)
  for (let stripe = 0; stripe < 42; stripe += 1) {
    context.fillStyle = `rgba(255,255,255,${stripe % 3 === 0 ? 0.12 : 0.04})`
    const x = (stripe / 42) * canvas.width
    const width = 4 + (stripe % 5)
    context.fillRect(x, 0, width, canvas.height)
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true
  textureCache.set(cacheKey, texture)
  return texture
}
