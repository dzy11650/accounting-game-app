/**
 * 罢工处理弹窗
 * 员工罢工后三选一：全额/部分/超额补发
 */
import React from 'react'
import { fmtW } from '../../lib/engine.js'

export default function StrikeDialog({ sim, onResolve }) {
  if (!sim?.pendingStrike) return null

  const owed = sim.wageUnpaid || 0
  const d = Math.round(sim.wageDiscontent || 0)

  const resolve = (option) => {
    onResolve(option)
  }

  return (
    <div className="page fade-in">
      <div className="card" style={{ borderLeft: '5px solid #e74c3c', background: '#FFF5F5', marginTop: 30 }}>
        <div style={{ fontSize: 30 }}>🪧</div>
        <div style={{ fontWeight: 800, color: '#e74c3c', marginTop: 4 }}>员工罢工了！</div>
        <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7 }}>
          因长期拖欠工资，员工发起罢工。当前累计欠薪 <b>¥{fmtW(owed)}万</b>，不满度 <b>{d}/100</b>。
          罢工当月效率骤降。你决定如何回应？
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          <button className="btn" onClick={() => resolve('full')}>💰 全额补发（结清欠薪，不满度清零）</button>
          <button className="btn ghost" onClick={() => resolve('partial')}>⚠️ 部分补发 50%（欠薪减半，不满度下降）</button>
          <button className="btn ghost" onClick={() => resolve('over')}>🔥 超额补发 150%（多花 50% 安抚金，彻底挽回人心）</button>
        </div>
      </div>
    </div>
  )
}
