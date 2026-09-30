import test from 'node:test'
import assert from 'node:assert/strict'
const B = await import('../data/badges.js')

test('BADGES includes new process achievements', () => {
  const ids = B.BADGES.map(b => b.id)
  assert.ok(ids.includes('noEvil'))
  assert.ok(ids.includes('cleanBook'))
  assert.ok(ids.includes('halfYear'))
  assert.ok(ids.includes('firstYear'))
  assert.ok(ids.includes('twoYear'))
  assert.ok(ids.includes('threeYear'))
})

test('BADGES has no duplicate ids', () => {
  const ids = B.BADGES.map(b => b.id)
  assert.equal(new Set(ids).size, ids.length)
})
