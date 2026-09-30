/**
 * 新手引导提示：连续 3 次错误分录时弹出
 * 解决"连续犯错无人指导"的问题
 */
import React from 'react'

export default function CoachHint({ wrongStreak, onDismiss }) {
  if (!wrongStreak || wrongStreak < 3) return null

  const tips = [
    '💡 先看「业务简报」里的金额和税率，这是判分依据',
    '💡 记住口诀：资产费用增在借，负债权益收入增在贷',
    '💡 每笔业务找两个科目：一借一贷，金额必须相等',
  ]

  return (
    <div className="card" style={{ borderLeft: '4px solid var(--gold)', background: '#FFF9F0' }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>🧑‍🏫 教练小贴士（已连续 {wrongStreak} 次记错）</div>
      {tips.map((t, i) => (
        <div key={i} style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.7, marginBottom: 2 }}>{t}</div>
      ))}
      <button className="btn ghost mt12" style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }} onClick={onDismiss}>知道了</button>
    </div>
  )
}
