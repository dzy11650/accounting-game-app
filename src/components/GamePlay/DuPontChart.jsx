/**
 * 杜邦分析拆解图（纯 CSS 柱状图，无依赖）
 * ROE = 净利率 × 资产周转率 × 权益乘数
 */
import React from 'react'
import { fmtW, totalAssets, liabilityTotal } from '../../lib/engine.js'

export default function DuPontChart({ state }) {
  const b = state.balances
  const netProfit = b['本年利润'] != null ? b['本年利润'] : 0
  const assets = totalAssets(b)
  const debt = liabilityTotal(state)
  const equity = Math.max(0.01, assets - debt)
  // 期间简化：以累计营收近似营收（月内为当月营收）
  const revenue = Math.max(0.01, state.cumSales || 0.01)

  const profitMargin = Math.max(-100, Math.min(100, +((netProfit / revenue) * 100).toFixed(1)))
  const turnover = Math.max(0, +(revenue / assets).toFixed(2))
  const multiplier = +(assets / equity).toFixed(2)
  const roe = +((profitMargin / 100) * turnover * multiplier).toFixed(2)

  const bars = [
    { label: '净利率', value: profitMargin, hint: `净利润 ${fmtW(netProfit)}万 ÷ 营收 ${fmtW(revenue)}万` },
    { label: '资产周转率', value: +(turnover * 10).toFixed(1), hint: `营收 ${fmtW(revenue)}万 ÷ 资产 ${fmtW(assets)}万 ×10` },
    { label: '权益乘数', value: +(multiplier * 10).toFixed(1), hint: `资产 ${fmtW(assets)}万 ÷ 权益 ${fmtW(equity)}万 ×10` },
  ]
  const maxVal = Math.max(10, ...bars.map(x => Math.abs(x.value)))

  return (
    <div className="card" style={{ background: '#F7FBF8' }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>📐 杜邦分析（ROE 拆解）</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: 90 }}>
        {bars.map((bar, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4, color: bar.value < 0 ? '#C0392B' : 'var(--primary-deep)' }}>
              {bar.value}
            </div>
            <div style={{
              height: 40, background: '#E6F6EC', borderRadius: 4,
              display: 'flex', alignItems: 'flex-end', overflow: 'hidden',
            }}>
              <div style={{
                width: '100%',
                height: `${Math.min(100, Math.abs(bar.value) / maxVal * 100)}%`,
                background: bar.value < 0 ? '#F3C0B5' : 'var(--primary)',
                borderRadius: 4,
              }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 4 }}>{bar.label}</div>
            <div style={{ fontSize: 10, color: 'var(--text-soft)', marginTop: 2 }}>{bar.hint}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: 'var(--accent-deep)' }}>
        综合 ROE ≈ {roe}%
        <span style={{ fontSize: 11, color: 'var(--text-soft)', fontWeight: 400, marginLeft: 8 }}>
          {roe >= 20 ? '（很优秀）' : roe >= 0 ? '（正常）' : '（亏损中）'}
        </span>
      </div>
    </div>
  )
}
