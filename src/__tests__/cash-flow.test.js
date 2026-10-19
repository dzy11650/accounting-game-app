import { test } from 'node:test'
import assert from 'node:assert'
import { createCompany, buildReports } from '../lib/engine.js'

test('现金流量表结构齐全且净增加额可勾稽', () => {
  const st = createCompany('shop', 'easy')
  const rep = buildReports(st)
  assert.ok(rep.cashFlow, 'cashFlow 字段应存在')
  assert.ok(rep.cashFlow.operating, 'operating 应存在')
  assert.ok(rep.cashFlow.investing, 'investing 应存在')
  assert.ok(rep.cashFlow.financing, 'financing 应存在')
  const sum = rep.cashFlow.operating.net + rep.cashFlow.investing.net + rep.cashFlow.financing.net
  assert.ok(Math.abs(sum - rep.cashFlow.netIncrease) < 0.05, `netIncrease 勾稽失败: sum=${sum} netIncrease=${rep.cashFlow.netIncrease}`)
  assert.ok(rep.cashFlow.closingCash >= 0, '期末现金不应为负')
})
