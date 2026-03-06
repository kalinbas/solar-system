import { describe, expect, it } from 'vitest'
import { BODY_CATALOG, BODY_INDEX } from './catalog'

describe('body catalog', () => {
  it('contains unique ids and resolvable parents', () => {
    const seen = new Set<string>()
    for (const body of BODY_CATALOG) {
      expect(seen.has(body.id)).toBe(false)
      seen.add(body.id)
      if (body.parentId) {
        expect(BODY_INDEX.has(body.parentId)).toBe(true)
      }
    }
  })

  it('includes a textured orbit model for every non-solar body', () => {
    for (const body of BODY_CATALOG) {
      expect(body.textureSet.textureFamily.length).toBeGreaterThan(0)
      if (body.kind !== 'sun') {
        expect(body.orbitModel).not.toBeNull()
      }
    }
  })

  it('contains the Sun, planets, and hundreds of moons', () => {
    expect(BODY_INDEX.has('sun')).toBe(true)
    expect(BODY_CATALOG.filter((body) => body.kind === 'planet')).toHaveLength(8)
    expect(BODY_CATALOG.filter((body) => body.kind === 'moon').length).toBeGreaterThan(300)
  })
})
