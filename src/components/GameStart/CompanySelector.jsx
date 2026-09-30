/**
 * 公司类型选择器
 * 玩家开局第一步：选择要经营的公司类型
 */
import React from 'react'
import { COMPANIES } from '../../data/companies.js'

export default function CompanySelector({ onSelect }) {
  return (
    <div className="page fade-in">
      <div className="section-title">🏢 选择公司类型</div>
      <div style={{ color: 'var(--text-soft)', fontSize: 13, marginBottom: 12 }}>
        不同行业有不同的会计科目和业务流程，选一个你感兴趣的开始吧～
      </div>
      {COMPANIES.map((c) => (
        <div
          key={c.id}
          className="card"
          style={{ cursor: 'pointer', marginBottom: 10 }}
          onClick={() => onSelect(c.id)}
        >
          <div style={{ fontWeight: 800, fontSize: 16 }}>
            {c.emoji} {c.name}
          </div>
          <div style={{ color: 'var(--text-soft)', fontSize: 12, marginTop: 4 }}>
            {c.blurb}
          </div>
          <div className="flex" style={{ marginTop: 8 }}>
            <span className="chip">难度 {'★'.repeat(c.difficulty)}</span>
            <span className="chip">启动 ¥{c.initCash}万</span>
            {c.projects?.length > 0 && (
              <span className="chip">{c.projects.length} 个经营项目</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
