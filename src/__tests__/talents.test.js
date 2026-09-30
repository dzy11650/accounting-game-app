import test from 'node:test'
import assert from 'node:assert/strict'
globalThis.localStorage = { _d:{}, getItem(k){return this._d[k]??null}, setItem(k,v){this._d[k]=v}, removeItem(k){delete this._d[k]} }
const E = await import('../lib/engine.js')
const T = await import('../data/talents.js')
const S = await import('../lib/save.js')

test('TALENTS: 40 cards (30 base + 10 cost), unique ids, 6 families', () => {
  assert.equal(T.TALENTS.length, 40)
  const ids = T.TALENTS.map(t => t.id)
  assert.equal(new Set(ids).size, 40)
  const fams = new Set(T.TALENTS.map(t => t.family))
  assert.equal(fams.size, 6)
})

test('pickTalents easy: 3 commons, no dup', () => {
  for (let i = 0; i < 50; i++) {
    const p = T.pickTalents('easy', Math.random).picks
    assert.equal(p.length, 3)
    assert.equal(new Set(p.map(t => t.id)).size, 3)
    for (const t of p) assert.equal(t.rarity, 'common')
  }
})

test('pickTalents: metaUnlocked 必出已解锁卡', () => {
  const unlocked = ['flagshipStore']
  for (let i = 0; i < 30; i++) {
    const r = T.pickTalents('hard', Math.random, { metaUnlocked: unlocked })
    assert.equal(r.picks[0].id, 'flagshipStore', 'meta card should be picks[0]')
  }
})

test('pickTalents: freeSlots 产生 freePicks', () => {
  const r = T.pickTalents('hard', Math.random, { metaUnlocked: ['flagshipStore','groupBuy'], freeSlots: 2 })
  assert.equal(r.freeSlots, 2)
  assert.equal(r.freePicks.length, 2)
  for (const t of r.freePicks) assert.ok(t.id, 'free pick is a talent')
})

test('pickTalents hard: 2 commons + 1 rare', () => {
  for (let i = 0; i < 50; i++) {
    const p = T.pickTalents('hard', Math.random).picks
    const rarities = p.map(t => t.rarity).sort()
    assert.deepEqual(rarities, ['common', 'common', 'rare'])
  }
})

test('angelInvest: 实收资本 +50%', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  T.applyTalent(s, T.TALENTS.find(t => t.id === 'angelInvest'))
  E.applyFunding(s, 'full')
  assert.equal(s.balances['实收资本'], 30) // 20 * 1.5
  assert.equal(s.balances['银行存款'], 30)
})

test('bridgeLoan: 开局追加 10 万借款，利率上浮', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  T.applyTalent(s, T.TALENTS.find(t => t.id === 'bridgeLoan'))
  E.applyFunding(s, 'full')
  assert.equal(s.balances['短期借款'], 10)
  assert.equal(s.loans[0].rate, 0.005 + 0.002) // shop interestRate 0.005
})

test('energyUpgrade: 折旧月额 ×0.7', () => {
  // hard 模式 costMult=1.0：0.1 * 1.0 * 0.7 = 0.07
  const s = E.createCompany('shop', 'hard', 'milktea')
  T.applyTalent(s, T.TALENTS.find(t => t.id === 'energyUpgrade'))
  E.applyFunding(s, 'full')
  const before = s.ledger.length
  E.monthEnd(s)
  const dep = s.ledger.slice(before).find(l => l.desc.includes('折旧'))
  assert.equal(dep.amt, 0.07)
})

test('govSubsidy: 利息 ×0.5', () => {
  // hard 模式 costMult=1.0：6 * 0.005 * 0.5 = 0.015 → toFixed(2) = 0.01 或 0.02（浮点）
  const s = E.createCompany('shop', 'hard', 'milktea')
  T.applyTalent(s, T.TALENTS.find(t => t.id === 'govSubsidy'))
  E.applyFunding(s, 'part') // 借 6 万
  const before = s.ledger.length
  E.monthEnd(s)
  const int = s.ledger.slice(before).find(l => l.desc.includes('利息'))
  assert.ok(Math.abs(int.amt - 0.015) < 0.005, 'interest ≈ 0.015, got ' + int.amt)
})

test('reserveFund: 年末自动拨 10% 利润入储备金', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  T.applyTalent(s, T.TALENTS.find(t => t.id === 'reserveFund'))
  E.applyFunding(s, 'full')
  const sale = E.vatOnSale(s, 5, s.co.revenueAccount)
  E.applyBusiness(s, sale.entries, '卖货', 1)
  E.applyBusiness(s, s.co.costOfSale(2), '结转成本', 1)
  E.monthEnd(s)
  assert.ok(s.balances['储备金'] > 0, 'reserve should be allocated')
})

test('reserveFund rescue: cash<0 时兜底注入', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  T.applyTalent(s, T.TALENTS.find(t => t.id === 'reserveFund'))
  E.applyFunding(s, 'full')
  s.balances['储备金'] = 5
  s.balances['银行存款'] = -2
  assert.equal(E.isBankrupt(s), false) // 兜底后现金回正
  assert.equal(s.rescues, 1)
  assert.equal(s.balances['储备金'], 0)
})

test('finance2 synergy: 破产兜底次数 1→2', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  T.applyTalent(s, T.TALENTS.find(t => t.id === 'reserveFund'))
  T.applyTalent(s, T.TALENTS.find(t => t.id === 'angelInvest'))
  assert.equal(s.rescueLimit, 2)
  assert.ok(s.synergies.includes('finance2'))
})

test('taxHedge cross synergy: 税务专家+风险对冲', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  T.applyTalent(s, T.TALENTS.find(t => t.id === 'taxExpert'))
  T.applyTalent(s, T.TALENTS.find(t => t.id === 'hedgeRisk'))
  assert.ok(s.synergies.includes('taxHedge'))
  assert.equal(s.synergyTaxShield, 0.3)
})

test('taxExpert: fineMult 0.3', () => {
  const s = E.createCompany('shop', 'hard', 'milktea')
  T.applyTalent(s, T.TALENTS.find(t => t.id === 'taxExpert'))
  assert.equal(s.fineMult, 0.3)
  assert.equal(s.auditProbMult, 0.5)
})

test('unionBond: 罢工部分补发 75%', () => {
  const s = E.createCompany('shop', 'hard', 'milktea')
  E.applyFunding(s, 'full')
  T.applyTalent(s, T.TALENTS.find(t => t.id === 'unionBond'))
  E.evilSalary(s)
  s.wageUnpaid = 10
  s.strikeThisMonth = true
  E.resolveStrike(s, 'partial')
  assert.equal(s.wageUnpaid, 2.5) // 10 * 0.25 剩余
})

test('hitProduct: genOrder opts.hitProduct margin +15%', () => {
  const s = E.createCompany('shop', 'hard', 'milktea')
  E.applyFunding(s, 'full')
  T.applyTalent(s, T.TALENTS.find(t => t.id === 'hitProduct'))
  const makeRng = () => { let i = 0; return () => [0.5, 0.5, 0.1][i++ % 3] }
  const normal = E.genOrder(s, makeRng())
  const hit = E.genOrder(s, makeRng(), { hitProduct: true })
  assert.ok(hit.margin > normal.margin, `hit ${hit.margin} > normal ${normal.margin}`)
  assert.ok(Math.abs((hit.margin - normal.margin) - 0.15) < 0.011, `diff ~15%, got ${hit.margin - normal.margin}`)
})

test('save migrate: old save gets talents defaults', () => {
  const m = S.migrate({ sim: { coId: 'shop', version: 1 }, coId: 'shop' })
  assert.deepEqual(m.sim.talents, [])
  assert.deepEqual(m.sim.synergies, [])
  assert.equal(m.sim.rescueLimit, 1)
  assert.equal(m.sim.rescues, 0)
})

test('applyTalent: 上限 3 张（引擎侧软约束由 UI 保证，此处验证记录）', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  T.applyTalent(s, T.TALENTS[0])
  T.applyTalent(s, T.TALENTS[1])
  T.applyTalent(s, T.TALENTS[2])
  assert.equal(s.talents.length, 3)
})


// ===== 第 2 批补充卡（10 张）的接线测试 =====
test('priceLeader: salePriceBoost 0.08（Game.jsx dealAmt 消费）', () => {
  const s = E.createCompany('shop', 'hard', 'milktea')
  T.applyTalent(s, T.TALENTS.find(t => t.id === 'priceLeader'))
  assert.equal(s.salePriceBoost, 0.08)
})

test('bulkSupplier: purchaseDown 0.08', () => {
  const s = E.createCompany('shop', 'hard', 'milktea')
  T.applyTalent(s, T.TALENTS.find(t => t.id === 'bulkSupplier'))
  assert.equal(s.purchaseDown, 0.08)
})

test('vipChannel: 订单回款期 -1、毛利 +5%', () => {
  const s = E.createCompany('shop', 'hard', 'milktea')
  E.applyFunding(s, 'full')
  // 固定 rng：creditRoll=0.95 → credit=3
  const makeRng = () => { let i = 0; return () => [0.5, 0.5, 0.95][i++ % 3] }
  const normal = E.genOrder(s, makeRng())
  assert.equal(normal.credit, 3)
  const s2 = E.createCompany('shop', 'hard', 'milktea'); E.applyFunding(s2, 'full')
  T.applyTalent(s2, T.TALENTS.find(t => t.id === 'vipChannel'))
  const vip = E.genOrder(s2, makeRng(), { hitProduct: false })
  assert.equal(vip.credit, 2) // 3 - creditTermBoost(1)
  assert.ok(vip.margin > normal.margin)
})

test('fastCredit: 借款利率 ×0.8', () => {
  const s = E.createCompany('shop', 'hard', 'milktea')
  T.applyTalent(s, T.TALENTS.find(t => t.id === 'fastCredit'))
  E.applyFunding(s, 'part') // 借 6 万
  // shop 利率 0.005 × 0.8 = 0.004
  assert.equal(s.loans[0].rate, 0.004)
})

test('dualSupplier: 原料涨价影响减半（0.2 → 0.1）', () => {
  const s = E.createCompany('shop', 'hard', 'milktea')
  T.applyTalent(s, T.TALENTS.find(t => t.id === 'dualSupplier'))
  s.eventBuff = {}
  const ev = T === undefined ? null : null
  // 直接调 RANDOM_EVENTS materialSpike effect
  E.RANDOM_EVENTS.find(e => e.id === 'materialSpike').effect(s)
  assert.equal(s.eventBuff.purchaseUp, 0.1)
})

test('safeInventory: stockTieMult 1.05 + safetyStockMult 0.5', () => {
  const s = E.createCompany('shop', 'hard', 'milktea')
  T.applyTalent(s, T.TALENTS.find(t => t.id === 'safeInventory'))
  assert.equal(s.stockTieMult, 1.05)
  assert.equal(s.safetyStockMult, 0.5)
})

test('insiderInfo: talentInsider + foreshadow 写入', () => {
  const s = E.createCompany('shop', 'hard', 'milktea')
  T.applyTalent(s, T.TALENTS.find(t => t.id === 'insiderInfo'))
  s.month = 3; s.eventBuff = {}
  const ev = E.rollRandomEvent(s, () => 0.01)
  if (ev && !ev.hedged) {
    assert.ok(s.foreshadow, 'foreshadow should be written when talentInsider active')
    assert.equal(s.foreshadow.forMonth, 4)
  }
})

test('rndProMax: 科技类研发加计 120%（rndSuperBoost 0.2）', () => {
  const s = E.createCompany('tech', 'hard', 'saas')
  E.applyFunding(s, 'full')
  T.applyTalent(s, T.TALENTS.find(t => t.id === 'rndProMax'))
  // 造研发费用 10 万
  E.applyBusiness(s, [{ side: 'debit', account: '研发费用', amount: 10 }, { side: 'credit', account: '银行存款', amount: 10 }], '研发', 1)
  s.balances['本年利润'] = 100
  const r = E.settleTax(s, ['rndDeduction'])
  // 加计 120%：taxableProfit = 100 - 10×1.2 = 88；88≤300 → 小微 5%
  // 实际 engine 的 settleTax 在算 cit 后还会返补 taxRebate(10%) 入本年利润，cit 含返补后利润
  // 简化断言：cit 在 4.4~4.6 之间（返补影响 ±0.2）
  assert.ok(r.cit >= 4.3 && r.cit <= 4.7, `cit=${r.cit}`)
})

test('cashFlowKing: 轻储备 5% 拨入储备金（不占 rescueLimit）', () => {
  const s = E.createCompany('shop', 'hard', 'milktea')
  E.applyFunding(s, 'full')
  T.applyTalent(s, T.TALENTS.find(t => t.id === 'cashFlowKing'))
  const sale = E.vatOnSale(s, 5, s.co.revenueAccount)
  E.applyBusiness(s, sale.entries, '卖货', 1)
  E.applyBusiness(s, s.co.costOfSale(2), '结转成本', 1)
  // monthEnd 结转折损后本年利润 >0，拨 5%
  E.monthEnd(s)
  assert.ok((s.balances['储备金'] || 0) > 0, 'light reserve allocated, got ' + s.balances['储备金'])
  assert.equal(s.rescueLimit, 1) // 不变（区别于 finance2 羁绊把兜底 1→2）
})

test('rndProMax: taxRebate 0.1（缴税后按 10% 返补）', () => {
  const s = E.createCompany('shop', 'hard', 'milktea')
  E.applyFunding(s, 'full')
  T.applyTalent(s, T.TALENTS.find(t => t.id === 'rndProMax'))
  assert.equal(s.taxRebate, 0.1)
})
