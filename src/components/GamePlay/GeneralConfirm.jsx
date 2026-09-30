/**
 * 一般纳税人转换确认弹窗
 */
import React from 'react'

export default function GeneralConfirm({ onConfirm, onCancel }) {
  return (
    <div className="page fade-in">
      <div className="card" style={{ borderLeft: '5px solid var(--accent-deep)', background: '#E9F8F6', marginTop: 30 }}>
        <div style={{ fontSize: 30 }}>🔁</div>
        <div style={{ fontWeight: 800, color: 'var(--accent-deep)', marginTop: 4 }}>转为一般纳税人？</div>
        <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.8 }}>
          转换后你将：
          <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 6 }}>
            • 增值税率从 3%（小规模征收率）变为 <b>13%</b><br />
            • 之后<b>进货/采购的进项税额可抵扣销项税额</b><br />
            • 需按月规范记账、能开专票（对大客户更有利）<br />
            • 一旦转为一般纳税人，<b>通常不能再转回小规模</b>
          </div>
          若你近期采购较多、或想给大客户开专票，转一般人才划算；否则继续小规模更省心。
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          <button className="btn" style={{ background: 'var(--accent-deep)', color: '#fff' }} onClick={onConfirm}>
            ✅ 确认转为一般纳税人（可抵扣进项）
          </button>
          <button className="btn ghost" onClick={onCancel}>❌ 暂不转换，保持小规模纳税人</button>
        </div>
      </div>
    </div>
  )
}
