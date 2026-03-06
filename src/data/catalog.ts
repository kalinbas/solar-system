import rawBodies from './generated/bodies.json'
import curatedTextures from './generated/curated-textures.json'
import referenceStatesJson from './generated/reference-states.json'
import type { BodyCatalogEntry, CatalogFile, ReferenceStatesFile } from '../types'

const catalogFile = rawBodies as CatalogFile
const referenceFile = referenceStatesJson as ReferenceStatesFile

export const DATA_SNAPSHOT_DATE = catalogFile.snapshotDate

export const BODY_CATALOG: BodyCatalogEntry[] = catalogFile.bodies.map((body) => ({
  ...body,
  textureSet: {
    ...body.textureSet,
    curatedPath: curatedTextures[body.id as keyof typeof curatedTextures] ?? null,
  },
}))

export const BODY_INDEX = new Map(BODY_CATALOG.map((body) => [body.id, body]))

export const REFERENCE_STATES = referenceFile.referenceStates

export function getBodyById(id: string): BodyCatalogEntry {
  const body = BODY_INDEX.get(id)
  if (!body) {
    throw new Error(`Unknown body: ${id}`)
  }

  return body
}

export function getChildren(parentId: string): BodyCatalogEntry[] {
  return BODY_CATALOG.filter((body) => body.parentId === parentId)
}
