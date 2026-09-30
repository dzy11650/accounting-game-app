/**
 * 天赋选择器（roguelike 三选一）
 * - 开局 / 每年初各一次
 * - 每张卡：emoji + 名称 + 效果 + 会计教学（展开）
 * - 稀有卡金色边框，普通卡白边框
 * - 可选跳过（仅开局，简单模式友好）
 */
import React, { useState } from 'react'
import { FAMILIES } from '../../data/talents.js'

const RARITY_STYLE = {
  common: { border: '2px solid var(--line)', badge: '◆ 普通', badgeBg: '#F2EFE8' },
  rare: { border: '2px solid var(--gold)', badge: '◈ 稀有', badgeBg: '#FFF3D6' },
  cost: { border: '2px solid #e74c3c', badge: '◉ 代价', badgeBg: '#FDEDEC' },
}

export default function TalentPicker({ picks, onSelect, onSkip, title, subtitle }) {
  const [openLearn, setOpenLearn] = useState({})
  if (!picks || picks.length === 0) return null

  return (
    <div className="page fade-in">
      <div className="card" style={{ textAlign: 'center', marginTop: 20 }}>
        <div style={{ fontSize: 40 }}>🎴</div>
        <div style={{ fontWeight: 800, fontSize: 18, marginTop: 6 }}>{title}</div>
        <div style={{ color: 'var(--text-soft)', fontSize: 12, marginTop: 6 }}>{subtitle}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        {picks.map((t) => {
          const fam = FAMILIES[t.family] || {}
          const rs = RARITY_STYLE[t.rarity] || RARITY_STYLE.common
          const [open, setOpen] = openLearn[t.id] || false
          return (
            <div key={t.id} style={{ border: rs.border, borderRadius: 12, padding: '12px 14px', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 26 }}>{t.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>{fam?.name}</div>
                </div>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: rs.badgeBg, color: 'var(--text-soft)' }}>
                  {rs.badge}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 8, lineHeight: 1.6 }}>{t.desc}</div>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--accent-deep)', fontSize: 12, cursor: 'pointer', padding: 0, marginTop: 6 }}
                onClick={() => setOpenLearn((o) => ({ ...o, [t.id]: !open }))}
              >
                {open ? '收起会计解读' : '💡 会计解读'}
              </button>
              {open && (
                <div style={{ fontSize: 12, color: 'var(--accent-deep)', background: '#E9F8F6', padding: '8px 10px', borderRadius: 8, marginTop: 6, lineHeight: 1.6 }}>
                  {t.learn}
                </div>
              )}
              <button className="btn mt12" style={{ width: '100%' }} onClick={() => onSelect(t)}>
                选择「{t.name}」
              </button>
            </div>
          )
        })}
      </div>

      {onSkip && (
        <button className="btn ghost" style={{ width: '100%' }} onClick={onSkip}>
          ⏭️ 跳过，不选天赋
        </button>
      )}
    </div>
  )
}
