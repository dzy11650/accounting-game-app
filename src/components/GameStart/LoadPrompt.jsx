/**
 * 存档加载提示
 * 检测到之前存档时显示
 */
import React from 'react'
import { COMPANIES } from '../../data/companies.js'
import { DIFFICULTY } from '../../lib/engine.js'

export default function LoadPrompt({ saveData, onContinue, onNewGame }) {
  const savedCo = COMPANIES.find((c) => c.id === saveData.coId)
  const savedDiff = DIFFICULTY[saveData.diffId]

  return (
    <div className="page fade-in">
      <div className="card" style={{ textAlign: 'center', marginTop: 40 }}>
        <div style={{ fontSize: 46 }}>📂</div>
        <div style={{ fontWeight: 800, fontSize: 18, marginTop: 8 }}>检测到之前的经营存档</div>
        <div style={{ color: 'var(--text-soft)', marginTop: 6 }}>
          {savedCo?.emoji} {savedCo?.name} · {savedDiff?.name}
        </div>
        <div style={{ color: 'var(--text-soft)', fontSize: 12, marginTop: 2 }}>
          进度：第 {saveData.chapterIdx + 1} 章第 {saveData.stepIdx + 1} 步
        </div>
        <button className="btn mt12" onClick={onContinue}>▶️ 继续上次的经营</button>
        <button className="btn ghost mt12" onClick={onNewGame}>🔄 重新开一家（清空存档）</button>
      </div>
    </div>
  )
}
