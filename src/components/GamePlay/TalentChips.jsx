/**
 * 天赋 chips 可视化
 * 显示已选天赋 + 已触发羁绊；悬停/展开显示效果与会计解读
 */
import React, { useState } from 'react'
import { TALENTS, SYNERGIES } from '../../data/talents.js'

const RARITY_BADGE = {
  common: { label: '◆', bg: '#F2EFE8' },
  rare: { label: '◈', bg: '#FFF3D6' },
  cost: { label: '◉', bg: '#FDEDEC' },
}

export default function TalentChips({ sim, compact = false }) {
  const [expanded, setExpanded] = useState(null)
  if (!sim) return null

  const talents = (sim.talents || []).map((id) => TALENTS.find((t) => t.id === id)).filter(Boolean)
  const synergies = (sim.synergies || []).map((id) => Object.values(SYNERGIES).find((x) => x.id === id)).filter(Boolean)
  if (!talents.length && !synergies.length) return null

  return (
    <div className="flex gap8 mt8" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* 天赋 chips */}
      {talents.map((t) => {
        const rb = RARITY_BADGE[t.rarity] || RARITY_BADGE.common
        const open = expanded === t.id
        return (
          <div key={t.id} style={{ position: 'relative' }}>
            <button
              onClick={() => setExpanded(open ? null : t.id)}
              style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 8, cursor: 'pointer',
                background: rb.bg, border: t.rarity === 'rare' ? '1px solid var(--gold)' : '1px solid var(--line)',
                color: 'var(--text)', fontWeight: 700,
              }}
            >
              {rb.label} {t.emoji} {t.name}
            </button>
            {open && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 20, marginTop: 4,
                width: 240, background: '#fff', border: '1.5px solid var(--line)', borderRadius: 10,
                padding: 10, boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{t.emoji} {t.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text)', lineHeight: 1.6 }}>{t.desc}</div>
                <div style={{ fontSize: 11, color: 'var(--accent-deep)', background: '#E9F8F6', padding: '6px 8px', borderRadius: 6, marginTop: 6, lineHeight: 1.6 }}>
                  💡 {t.learn}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* 羁绊 chips */}
      {!compact && synergies.map((sy) => (
        <span
          key={sy.id}
          title={sy.desc}
          style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 8,
            background: 'linear-gradient(135deg,#FFF3D6,#FFE9A8)', color: '#8a6d00',
            fontWeight: 700, border: '1px solid var(--gold)',
          }}
        >
          ✨ {sy.name}
        </span>
      ))}

      {/* 上限提示 */}
      <span style={{ fontSize: 10.5, color: 'var(--text-soft)' }}>
        天赋 {talents.length}/3
      </span>
    </div>
  )
}
