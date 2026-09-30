import test from 'node:test'
import assert from 'node:assert/strict'
globalThis.localStorage = { _d:{}, getItem(k){return this._d[k]??null}, setItem(k,v){this._d[k]=v}, removeItem(k){delete this._d[k]} }
const E = await import('../lib/engine.js')
const T = await import('../data/talents.js')

test('insiderInfo: 事件触发后 foreshadow 写入下月倾向', () => {
  const s = E.createCompany('shop', 'hard', 'milktea')
  T.applyTalent(s, T.TALENTS.find(t => t.id === 'insiderInfo'))
  s.month = 3
  s.eventBuff = {}
  const ev = E.rollRandomEvent(s, () => 0.01)
  if (ev && !ev.hedged) {
    assert.ok(s.foreshadow, 'foreshadow should exist')
    assert.equal(s.foreshadow.forMonth, 4)
    assert.ok(['good','bad','neutral'].includes(s.foreshadow.tone))
  }
})

test('insiderInfo: 无天赋时不写 foreshadow', () => {
  const s = E.createCompany('shop', 'hard', 'milktea')
  s.month = 3
  s.eventBuff = {}
  E.rollRandomEvent(s, () => 0.01)
  assert.equal(s.foreshadow, undefined)
})
