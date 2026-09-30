import test from 'node:test'
import assert from 'node:assert/strict'
globalThis.localStorage = { _d:{}, getItem(k){return this._d[k]??null}, setItem(k,v){this._d[k]=v}, removeItem(k){delete this._d[k]} }
const E = await import('../lib/engine.js')

test('checkProcessBadges: hardcore clean pass = cleanBook', () => {
  const s = E.createCompany('shop', 'hardcore', 'milktea')
  E.applyFunding(s, 'full')
  const earned = E.checkProcessBadges(s)
  assert.ok(earned.includes('cleanBook'))
})

test('checkProcessBadges: 12 months no evil = noEvil', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  E.applyFunding(s, 'full')
  s.month = 12
  const earned = E.checkProcessBadges(s)
  assert.ok(earned.includes('noEvil'))
})

test('checkProcessBadges: no dup earn', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  s.month = 12
  E.checkProcessBadges(s)
  const again = E.checkProcessBadges(s)
  assert.equal(again.length, 0)
})

test('checkProcessBadges: evil used = no noEvil', () => {
  const s = E.createCompany('shop', 'hard', 'milktea')
  E.applyFunding(s, 'full')
  E.evilSalary(s)
  s.month = 12
  const earned = E.checkProcessBadges(s)
  assert.equal(earned.includes('noEvil'), false)
})
