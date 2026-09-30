import test from 'node:test'
import assert from 'node:assert/strict'
const M = await import('../lib/share.js')

test('buildShareText: success case includes milestones', () => {
  const text = M.buildShareText(
    { ok: true, stars: 3, profit: 100, months: 24, ordersFulfilled: 10, milestones: [{ title: '首年盈利' }], scores: { compliance: 100 } },
    '奶茶店', '经典奶茶'
  )
  assert.ok(text.includes('✅ 通关'))
  assert.ok(text.includes('⭐⭐⭐'))
  assert.ok(text.includes('首年盈利'))
  assert.ok(text.includes('正道经营'))
})

test('buildShareText: evil case mentions risk', () => {
  const text = M.buildShareText(
    { ok: false, stars: 0, profit: -10, months: 3, milestones: [], scores: { compliance: 20 } },
    '工厂', ''
  )
  assert.ok(text.includes('邪道'))
})

test('copyText degrades gracefully when no clipboard and no document', async () => {
  // node 环境无 document：copyText 应返回 ok:false 而非抛异常
  const r = await M.copyText('hello')
  assert.equal(typeof r, 'object')
})
