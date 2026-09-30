import test from 'node:test'
import assert from 'node:assert/strict'
globalThis.localStorage = { _d:{}, getItem(k){return this._d[k]??null}, setItem(k,v){this._d[k]=v}, removeItem(k){delete this._d[k]} }
const E = await import('../lib/engine.js')

test('RANDOM_EVENTS has 16 entries with unique ids', () => {
  const ids = E.RANDOM_EVENTS.map(e => e.id)
  assert.equal(ids.length, 16)
  assert.equal(new Set(ids).size, 16)
  const expected = ['materialSpike','viral','inspection','staffLeave','groupOrder','rentFree','refund','subsidy',
    'supplierCut','clientArrears','policyCUT','staffRise','equipmentBreak','pressCoverage','powerOutage','taxRemit']
  for (const id of expected) assert.ok(ids.includes(id), `missing ${id}`)
})

test('rollRandomEvent: deterministic rng picks an event and sets lastEvent', () => {
  const s = E.createCompany('shop', 'hard', 'milktea')
  E.applyFunding(s, 'full')
  s.month = 3 // 3 的倍数才触发
  s.eventBuff = {}
  const ev = E.rollRandomEvent(s, () => 0.01) // 固定小值 → 大概率命中权重累计靠前的事件
  assert.ok(ev, 'event should fire on month%3===0')
  assert.equal(s.lastEvent, ev)
  assert.equal(ev.month, 3)
})

test('rollRandomEvent: non-multiple-of-3 returns null (buff kept until next roll)', () => {
  const s = E.createCompany('shop', 'hard', 'milktea')
  s.month = 1
  s.eventBuff = { saleUp: 0.5 }
  const ev = E.rollRandomEvent(s, () => 0.5)
  assert.equal(ev, null)
})

test('event effects: supplierCut sets purchaseDown buff', () => {
  const s = E.createCompany('shop', 'hard', 'milktea')
  s.eventBuff = {}
  const pick = E.RANDOM_EVENTS.find(e => e.id === 'supplierCut')
  pick.effect(s)
  assert.equal(s.eventBuff.purchaseDown, 0.1)
})

test('event effects: staffRise sets salaryUp buff', () => {
  const s = E.createCompany('shop', 'hard', 'milktea')
  s.eventBuff = {}
  const pick = E.RANDOM_EVENTS.find(e => e.id === 'staffRise')
  pick.effect(s)
  assert.equal(s.eventBuff.salaryUp, 0.08)
})

test('event effects: cash-affecting events post journal entries', () => {
  for (const id of ['clientArrears','policyCUT','equipmentBreak','taxRemit']) {
    const s = E.createCompany('shop', 'hard', 'milktea')
    E.applyFunding(s, 'full')
    s.eventBuff = {}
    const before = s.ledger.length
    E.RANDOM_EVENTS.find(e => e.id === id).effect(s)
    assert.ok(s.ledger.length > before, `${id} should post entries`)
  }
})
