/**
 * 财务诊断卡片
 * 展示每次操作后的财务影响分析
 */
import React from 'react'
import { fmtW } from '../../lib/engine.js'

export default function AnalysisCard({ analysis }) {
  if (!analysis) return null

  return (
    <div className="card" style={{
      background: analysis.alert ? '#FFF6F4' : '#F7FBF8',
      border: `1px solid ${analysis.alert ? '#F3C0B5' : '#BFE3D0'}`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontWeight: 800 }}>🔍 财务诊断 · {analysis.title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>本步决策影响</div>
      </div>

      {analysis.impacts.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {analysis.impacts.map((it, i) => (
            <span key={i} style={{
              fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 8,
              background: it.good ? '#E6F6EC' : '#FDEAE6',
              color: it.good ? '#1F8A4C' : '#C0392B',
            }}>
              {it.label} {it.dir === 'up' ? '▲' : '▼'} {fmtW(it.value)}
            </span>
          ))}
        </div>
      )}

      {analysis.focus && (
        <div style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--text)', marginBottom: 6 }}>
          {analysis.focus}
        </div>
      )}

      <div style={{
        fontSize: 12.5, fontWeight: 700, lineHeight: 1.6, marginBottom: 8,
        color: analysis.alert ? '#C0392B' : '#1F8A4C',
      }}>
        {analysis.diagnosis}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6 }}>
        {[
          { k: '现金(万)', v: fmtW(analysis.snapshot.cash), warn: analysis.snapshot.cash < 2 },
          { k: '累计净利(万)', v: fmtW(analysis.snapshot.netProfit), warn: analysis.snapshot.netProfit < 0 },
          { k: '负债率', v: analysis.snapshot.debtRatio + '%', warn: analysis.snapshot.debtRatio > 70 },
          { k: '合规度', v: analysis.snapshot.compliance + '/100', warn: analysis.snapshot.compliance < 40 },
        ].map((m, i) => (
          <div key={i} style={{
            background: '#fff', borderRadius: 8, padding: '6px 8px', textAlign: 'center',
            border: `1px solid ${m.warn ? '#F3C0B5' : '#ECECEC'}`,
          }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-soft)' }}>{m.k}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: m.warn ? '#C0392B' : 'var(--text)' }}>{m.v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
