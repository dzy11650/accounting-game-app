/**
 * 报表轻量渲染器
 * 用于在游戏内实时展示三张表
 */
import React from 'react'
import { fmtW } from '../../lib/engine.js'

export default function ReportLite({ report }) {
  if (!report) return null

  const title = report.type === 'balance' ? '资产负债表'
              : report.type === 'income' ? '利润表'
              : '现金流量表'

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{title}</div>
      {report.note && (
        <div style={{ fontSize: 10.5, color: 'var(--text-soft)', marginBottom: 4 }}>({report.note})</div>
      )}
      {report.rows.map((r, i) => {
        if (r.level === 'h') {
          return (
            <div key={i} style={{ fontSize: 12, fontWeight: 800, marginTop: 6, color: 'var(--accent-deep)' }}>
              {r.item}
            </div>
          )
        }
        const isTotal = r.level === 'total' || r.emphasize
        const isSub = r.level === 'sub'
        const neg = r.value != null && r.value < 0
        return (
          <div key={i} className="flex between center" style={{
            fontSize: isTotal ? 12.5 : 12,
            fontWeight: isTotal ? 800 : (isSub ? 700 : 400),
            padding: '2px 0',
            paddingLeft: isSub || isTotal ? 8 : 0,
            borderTop: isTotal ? '1px solid #d9d2c4' : 'none',
            color: neg ? '#C0392B' : (isTotal ? 'var(--primary-deep)' : 'var(--text)'),
          }}>
            <span>{r.item}</span>
            <span>{r.value == null ? '' : '¥' + fmtW(r.value) + '万'}</span>
          </div>
        )
      })}
    </div>
  )
}
