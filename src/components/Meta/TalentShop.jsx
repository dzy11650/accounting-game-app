/**
 * 局外天赋商店：用金币永久解锁天赋卡
 * - 金币来源：每局结算（营业利润越大金币越多）
 * - 解锁后天赋进入下局的开局三选一池（必出 1 张已解锁卡）
 * - 稀有卡贵、代价卡最贵，common 便宜
 */
import React from 'react'
import { useUser } from '../../store/UserContext.jsx'
import { TALENTS, FAMILIES } from '../../data/talents.js'

// 定价：common 30 / rare 60 / cost 100（金币）
export const TALENT_COST = (t) => (t.rarity === 'cost' ? 100 : t.rarity === 'rare' ? 60 : 30)

export default function TalentShop() {
  const { state, dispatch } = useUser()
  const owned = state.metaUnlockedTalents || []

  const buy = (t) => {
    const cost = TALENT_COST(t)
    if (state.coins < cost || owned.includes(t.id)) return
    dispatch({ type: 'UNLOCK_TALENT', id: t.id, cost })
  }

  const byFam = {}
  TALENTS.forEach((t) => { (byFam[t.family] = byFam[t.family] || []).push(t) })

  return (
    <div className="card">
      <div className="flex between center" style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>🛒 天赋商店（局外）</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>🪙 {state.coins}</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 10, lineHeight: 1.6 }}>
        用金币永久解锁天赋卡。解锁后，下局开局三选一中会<b>必出 1 张已解锁卡</b>。
        营业利润越大，结算拿到的金币越多。
      </div>

      {Object.entries(byFam).map(([famId, list]) => {
        const fam = FAMILIES[famId]
        return (
          <div key={famId} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: fam.color, marginBottom: 6 }}>{fam.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {list.map((t) => {
                const isOwned = owned.includes(t.id)
                const cost = TALENT_COST(t)
                const canBuy = !isOwned && state.coins >= cost
                const rs = t.rarity === 'cost' ? { bg: '#FDEDEC', bd: '#e74c3c' } : t.rarity === 'rare' ? { bg: '#FFF3D6', bd: 'var(--gold)' } : { bg: '#F7F5F0', bd: 'var(--line)' }
                return (
                  <div key={t.id} style={{ background: rs.bg, border: `1.5px solid ${isOwned ? 'var(--primary)' : rs.bd}`, borderRadius: 10, padding: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 16 }}>{t.emoji}</span>
                      <span style={{ fontWeight: 700, fontSize: 12 }}>{t.name}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-soft)', marginLeft: 'auto' }}>
                        {t.rarity === 'cost' ? '◉' : t.rarity === 'rare' ? '◈' : '◆'}
                      </span>
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-soft)', margin: '4px 0', lineHeight: 1.4 }}>{t.desc}</div>
                    {isOwned ? (
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>✓ 已解锁</div>
                    ) : (
                      <button
                        className={canBuy ? 'btn' : 'btn ghost'}
                        style={{ width: '100%', padding: '4px 8px', fontSize: 11, marginTop: 2, opacity: canBuy ? 1 : 0.5 }}
                        onClick={() => buy(t)}
                        disabled={!canBuy}
                      >
                        解锁 · 🪙{cost}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 6 }}>
        <div className="flex between center">
          <span style={{ fontSize: 12, fontWeight: 700 }}>🎖️ 局外等级 Lv.{state.metaLevel || 1}</span>
          <span style={{ fontSize: 11, color: 'var(--text-soft)' }}>经验 {state.metaXp || 0} / {((state.metaLevel || 1) * 500)}</span>
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-soft)', marginTop: 4 }}>
          每局结算获得局外经验 = 净利润 × 2。等级提升会增加开局免费天赋位。
        </div>
      </div>
    </div>
  )
}
