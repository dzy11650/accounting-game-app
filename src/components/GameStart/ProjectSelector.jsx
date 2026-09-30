/**
 * 经营项目选择器
 * 玩家选完公司类型后，选择具体经营项目 + 难度
 */
import React from 'react'
import { DIFFICULTY } from '../../lib/engine.js'

const DIFF_DESC = {
  easy: '系统给分录，错了自动修正，容错3次',
  hard: '自己写分录，金额随机，错1次扣容错',
  hardcore: '错1次即失败，学不到最终关',
}

export default function ProjectSelector({ company, selectedDiff, onSelectDiff, onQuickStart }) {
  const projects = company?.projects || []

  return (
    <div className="page fade-in">
      <button className="btn ghost" style={{ marginBottom: 10 }} onClick={() => onSelectDiff(null)}>← 换家公司</button>
      <div className="section-title">{company?.emoji} {company?.name} · 选经营项目</div>
      <div style={{ color: 'var(--text-soft)', fontSize: 12, marginBottom: 12 }}>
        同一类公司也分不同产品线，参数与难点略有差异，挑一个你熟悉的吧～
      </div>

      {projects.length === 0 ? (
        <div className="card">该产品线暂未细分经营项目，直接选择难度开始。</div>
      ) : projects.map((p) => (
        <div key={p.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 800 }}>{p.emoji} {p.name}</div>
          <div style={{ color: 'var(--text-soft)', fontSize: 12, marginTop: 4 }}>{p.blurb}</div>
          {p.econ && (
            <div className="flex" style={{ marginTop: 6 }}>
              {p.econ.margin != null && <span className="chip">毛利 {Math.round(p.econ.margin * 100)}%</span>}
              {p.econ.dealSize != null && <span className="chip">单笔 ¥{p.econ.dealSize}万</span>}
            </div>
          )}
          <div className="section-title" style={{ margin: '12px 0 8px', fontSize: 14 }}>选择难度</div>
          {Object.values(DIFFICULTY).map((d) => (
            <button
              key={d.id}
              className={`btn ${selectedDiff === d.id ? '' : 'ghost'}`}
              style={{ width: '100%', padding: '10px', marginBottom: 6, textAlign: 'left' }}
              onClick={() => onSelectDiff(d.id, p.id)}
            >
              <div style={{ fontWeight: 700 }}>{d.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 2 }}>
                {DIFF_DESC[d.id]}
              </div>
            </button>
          ))}
        </div>
      ))}

      {projects.length > 0 && (
        <button className="btn mt12" style={{ width: '100%' }} onClick={() => onQuickStart(projects[0].id)}>
          直接开干（默认 {projects[0].emoji}{projects[0].name} · {DIFFICULTY[selectedDiff || 'easy'].name}）
        </button>
      )}
    </div>
  )
}
