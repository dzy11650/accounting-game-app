/**
 * 邪道风险指示器
 * 可视化显示当前罢工风险和税务稽查风险
 * 解决"邪道玩法风险收益不透明"问题
 */
import React from 'react'

const STRIKE_RISK_LEVELS = [
  { max: 20, label: '安全', color: '#27ae60', bg: '#E6F6EC' },
  { max: 40, label: '低风险', color: '#f39c12', bg: '#FFF8E6' },
  { max: 60, label: '中风险', color: '#e67e22', bg: '#FDEBD0' },
  { max: 80, label: '高风险', color: '#e74c3c', bg: '#FDEDEC' },
  { max: 100, label: '极高', color: '#c0392b', bg: '#FADBD8' },
]

const AUDIT_RISK_LEVELS = [
  { max: 0.1, label: '安全', color: '#27ae60', bg: '#E6F6EC' },
  { max: 0.3, label: '低风险', color: '#f39c12', bg: '#FFF8E6' },
  { max: 0.5, label: '中风险', color: '#e67e22', bg: '#FDEBD0' },
  { max: 0.7, label: '高风险', color: '#e74c3c', bg: '#FDEDEC' },
  { max: 1.0, label: ' imminent', color: '#c0392b', bg: '#FADBD8' },
]

function getRiskLevel(value, thresholds) {
  for (const t of thresholds) {
    if (value <= t.max) return t
  }
  return thresholds[thresholds.length - 1]
}

export default function EvilRiskIndicator({ sim }) {
  if (!sim || sim.evilCount === 0) return null

  const wageDiscontent = sim.wageDiscontent || 0
  const strikeRisk = Math.min(1, wageDiscontent / 100)

  const taxAdjusts = sim.taxAdjusts || 0
  const taxOwed = sim.taxOwed || 0
  // 与 engine.taxAudit 一致：取 max(调账概率, 拖欠概率)，各自封顶
  const adjustP = Math.min(0.6, 0.08 * taxAdjusts)
  const oweP = Math.min(0.5, 0.06 * (sim.skippedTaxMonths || 0))
  const auditRisk = Math.max(adjustP, oweP)

  const strikeLevel = getRiskLevel(wageDiscontent, STRIKE_RISK_LEVELS)
  const auditLevel = getRiskLevel(auditRisk, AUDIT_RISK_LEVELS)

  return (
    <div className="card" style={{ background: '#FFF9F0', borderLeft: '4px solid var(--gold)' }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>⚠️ 风险看板</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {/* 罢工风险 */}
        <div style={{ background: strikeLevel.bg, borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-soft)', marginBottom: 4 }}>🪧 罢工风险</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, height: 6, background: '#e6e1d6', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${wageDiscontent}%`, height: '100%', background: strikeLevel.color, borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: strikeLevel.color }}>{strikeLevel.label}</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-soft)', marginTop: 4 }}>
            不满度 {Math.round(wageDiscontent)}/100 · 欠薪 ¥{(sim.wageUnpaid || 0).toFixed(1)}万
          </div>
        </div>

        {/* 税务稽查风险 */}
        <div style={{ background: auditLevel.bg, borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-soft)', marginBottom: 4 }}>🚨 稽查风险</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, height: 6, background: '#e6e1d6', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(auditRisk * 100)}%`, height: '100%', background: auditLevel.color, borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: auditLevel.color }}>{auditLevel.label}</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-soft)', marginTop: 4 }}>
            调账 {taxAdjusts} 次 · 欠税 ¥{(sim.taxOwed || 0).toFixed(1)}万
          </div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-soft)', marginTop: 8, lineHeight: 1.5 }}>
        💡 提示：邪道玩得越多，风险越高。正道经营虽然慢，但睡得安稳。
      </div>
    </div>
  )
}
