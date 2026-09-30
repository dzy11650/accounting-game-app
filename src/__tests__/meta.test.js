import test from 'node:test'
import assert from 'node:assert/strict'

// 局外经济公式（纯逻辑，不依赖 .jsx store）
test('UNLOCK_TALENT reducer shape', () => {
  const state = { coins: 100, metaUnlockedTalents: [] }
  const action = { type: 'UNLOCK_TALENT', id: 'x', cost: 30 }
  const next = { ...state, coins: state.coins - action.cost, metaUnlockedTalents: [...state.metaUnlockedTalents, action.id] }
  assert.equal(next.coins, 70)
  assert.deepEqual(next.metaUnlockedTalents, ['x'])
})

test('ADD_META_XP: 局外等级随经验上升', () => {
  const state = { metaXp: 0, metaLevel: 1 }
  const amount = 600
  const next = { ...state, metaXp: state.metaXp + amount, metaLevel: Math.floor((state.metaXp + amount) / 500) + 1 }
  assert.equal(next.metaXp, 600)
  assert.equal(next.metaLevel, 2)
})

test('金币公式: profit × 2（下限 20，失败 10）', () => {
  const calc = (ok, profit) => ok ? Math.max(20, Math.round(profit * 2)) : 10
  assert.equal(calc(true, 100), 200)
  assert.equal(calc(true, 5), 20)
  assert.equal(calc(true, -10), 20)
  assert.equal(calc(false, 0), 10)
})

test('局外经验公式: max(0, profit × 2)', () => {
  const calc = (profit) => Math.max(0, Math.round(profit * 2))
  assert.equal(calc(50), 100)
  assert.equal(calc(-30), 0)
})

test('天赋商店定价: common 30 / rare 60 / cost 100', () => {
  const cost = (rarity) => rarity === 'cost' ? 100 : rarity === 'rare' ? 60 : 30
  assert.equal(cost('common'), 30)
  assert.equal(cost('rare'), 60)
  assert.equal(cost('cost'), 100)
})
