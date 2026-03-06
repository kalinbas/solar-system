import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import * as cheerio from 'cheerio'

const PAGE_NAMES = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']
const OUTPUT_DIR = path.resolve(process.cwd(), 'public/textures/curated')
const MANIFEST_PATH = path.resolve(process.cwd(), 'src/data/generated/curated-textures.json')

function normalizeBodyName(value) {
  return value
    .split('/')
    .at(-1)
    .replace(/\s+/g, ' ')
    .trim()
}

function toId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function fetchText(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }

  return response.text()
}

async function downloadFile(url, destination) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  await fs.writeFile(destination, Buffer.from(arrayBuffer))
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true })

  const manifest = {}

  for (const pageName of PAGE_NAMES) {
    const url = `https://space.jpl.nasa.gov/tmaps/${pageName}.html`
    const html = await fetchText(url)
    const $ = cheerio.load(html)
    const bestRows = new Map()

    $('tr').each((_, row) => {
      const cells = $(row).find('td')
      if (cells.length < 8) {
        return
      }

      const rawName = $(cells[1]).text()
      const bodyName = normalizeBodyName(rawName)
      if (!bodyName || bodyName === 'Body') {
        return
      }

      const jpgLinks = $(cells[2])
        .find('a')
        .map((__, link) => {
          const href = $(link).attr('href')?.trim()
          return href && href.endsWith('.jpg') ? href : null
        })
        .get()
        .filter(Boolean)

      if (jpgLinks.length === 0) {
        return
      }

      const width = Number.parseInt($(cells[6]).text(), 10)
      const height = Number.parseInt($(cells[7]).text(), 10)
      const area = Number.isFinite(width) && Number.isFinite(height) ? width * height : 0
      const current = bestRows.get(bodyName)

      if (!current || area > current.area) {
        bestRows.set(bodyName, {
          area,
          href: jpgLinks.at(-1),
        })
      }
    })

    for (const [bodyName, entry] of bestRows.entries()) {
      const bodyId = toId(bodyName)
      const destination = path.join(OUTPUT_DIR, `${bodyId}.jpg`)
      const sourceUrl = new URL(entry.href, url).href
      await downloadFile(sourceUrl, destination)
      manifest[bodyId] = `/textures/curated/${bodyId}.jpg`
    }
  }

  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true })
  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
