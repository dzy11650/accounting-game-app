/**
 * save.js 单元测试
 * 运行: node --test src/__tests__/save.test.js
 */
import test from 'node:test'
import assert from 'node:assert/strict'

globalThis.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] ?? null },
  setItem(k, v) { this._d[k] = v },
  removeItem(k) { delete this._d[k] },
}

const S = await import('../lib/save.js')

test('writeSave then loadSave roundtrip', () => {
  S.clearSave()
  S.writeSave({ sim: { x: 1 }, coId: 'shop', diffId: 'easy', chapterIdx: 0, stepIdx: 0, ended: false })
  const s = S.loadSave()
  assert.equal(s.coId, 'shop')
  assert.equal(s.version, 1)
  assert.equal(s.sim.x, 1)
})

test('loadSave returns null when empty', () => {
  S.clearSave()
  assert.equal(S.loadSave(), null)
})

test('loadSave returns null for corrupt JSON', () => {
  localStorage.setItem('accounting_game_save_v1', '{bad json')
  assert.equal(S.loadSave(), null)
})

test('loadSave returns null when shape invalid', () => {
  S.clearSave()
  localStorage.setItem('accounting_game_save_v1', JSON.stringify({ foo: 1 }))
  assert.equal(S.loadSave(), null)
})

test('migrate adds version to old save', () => {
  const s = S.migrate({ sim: {}, coId: 'shop' })
  assert.equal(s.version, 1)
})

test('SAVE_VERSION constant', () => {
  assert.equal(S.SAVE_VERSION, 1)
})
