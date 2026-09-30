/**
 * 游戏状态栏
 * 显示现金、利润、容错、营收、负债、规模等关键指标
 */
import React from 'react'
import { MOOD_LABEL } from '../../lib/engine.js'
import { MILESTONES } from '../../lib/engine.js'
import TalentChips from './TalentChips.jsx'

export default function GameStateBar({ sim, chapter }) {
  if (!sim) return null

  return (
    <div className="card">
      <div className="flex between center">
        <div style={{ fontWeight: 800 }}>
          {sim.co?.emoji} {sim.co?.name}
          {sim.projectEmoji ? ` · ${sim.projectEmoji}${sim.projectName}` : ''}
        </div>
        <span className="chip">{sim.difficulty === 'easy' ? '简单' : sim.difficulty === 'hard' ? '困难' : '硬核'}</span>
      </div>
      <div className="flex gap8 mt12">
        <div className="shop-stat" style={{ flex: 1, marginBottom: 0 }}>
          <span>💵 现金</span>
          <span className="v">¥{(sim.balances['银行存款'] || 0).toFixed(1)}万</span>
        </div>
        <div className="shop-stat" style={{ flex: 1, marginBottom: 0 }}>
          <span>📈 利润</span>
          <span className="v">¥{(sim.balances['本年利润'] || 0).toFixed(1)}万</span>
        </div>
        <div className="shop-stat" style={{ flex: 1, marginBottom: 0 }}>
          <span>❤️ 容错</span>
          <span className="v">{sim.lives}</span>
        </div>
      </div>
      <div className="flex gap8 mt8">
        <div className="shop-stat" style={{ flex: 1, marginBottom: 0 }}>
          <span>🧾 营收</span>
          <span className="v">¥{(sim.cumSales || 0).toFixed(1)}万</span>
        </div>
        <div className="shop-stat" style={{ flex: 1, marginBottom: 0 }}>
          <span>🏦 负债</span>
          <span className="v">¥{((sim.balances['短期借款'] || 0) + (sim.balances['应付账款'] || 0) + (sim.balances['应付职工薪酬'] || 0)).toFixed(1)}万</span>
        </div>
        <div className="shop-stat" style={{ flex: 1, marginBottom: 0 }}>
          <span>📏 规模</span>
          <span className="v">×{(sim.scale || 1).toFixed(2)}</span>
        </div>
      </div>

      {chapter?.loop && (
        <>
          <div className="flex gap8 mt8">
            <div className="shop-stat" style={{ flex: 1, marginBottom: 0 }}>
              <span>🌤️ 行情</span>
              <span className="v">{MOOD_LABEL[sim.yearMood] || '⛅ 平常年'}（第{sim.year || 1}年）</span>
            </div>
            <div className="shop-stat" style={{ flex: 1, marginBottom: 0 }}>
              <span>😈 邪道</span>
              <span className="v">{sim.evilCount || 0} 次</span>
            </div>
          </div>

          {/* 当前随机事件提示条 */}
          {sim.lastEvent && (
            <div className="flex gap8 mt8" style={{ alignItems: 'center' }}>
              <div className="shop-stat" style={{ flex: 1, marginBottom: 0, background:
                sim.lastEvent.tone === 'good' ? '#E3F6EF' :
                sim.lastEvent.tone === 'bad' ? '#FDECEC' : '#FFF7E6'
              }}>
                <span>{sim.lastEvent.emoji} {sim.lastEvent.title}</span>
                <span className="v" style={{ fontSize: 11, fontWeight: 500 }}>{sim.lastEvent.desc}</span>
              </div>
            </div>
          )}

          {/* roguelike 天赋 chips：已选天赋 + 已触发羁绊 */}
          <TalentChips sim={sim} />

          {/* 天赋·内幕消息：提前 1 个月知道下月事件倾向 */}
          {sim.foreshadow && (
            <div className="flex gap8 mt8">
              <div className="shop-stat" style={{ flex: 1, marginBottom: 0, background: '#F4F1FF' }}>
                <span>🕵️ 内幕</span>
                <span className="v" style={{ fontSize: 11 }}>
                  下月（第{sim.foreshadow.forMonth}月）{sim.foreshadow.tone === 'good' ? '可能有好消息 📈' : sim.foreshadow.tone === 'bad' ? '可能有坏消息 ⚠️' : '行情平稳 ⚖️'}
                </span>
              </div>
            </div>
          )}

          {/* 本月生效的经营系数（事件 buff 可视化） */}
          {(() => {
            const buffs = []
            const b = sim.eventBuff || {}
            if (b.saleUp) buffs.push(`销售 ${b.saleUp > 0 ? '+' : ''}${Math.round(b.saleUp * 100)}%`)
            if (b.purchaseUp) buffs.push(`采购成本 +${Math.round(b.purchaseUp * 100)}%`)
            if (b.purchaseDown) buffs.push(`采购成本 -${Math.round(b.purchaseDown * 100)}%`)
            if (b.salaryUp) buffs.push(`工资 +${Math.round(b.salaryUp * 100)}%`)
            if (b.skipRent) buffs.push('免房租')
            if (!buffs.length) return null
            return (
              <div className="flex gap8 mt8" style={{ flexWrap: 'wrap' }}>
                {buffs.map((t, i) => (
                  <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#F2EFE8', color: 'var(--text-soft)' }}>
                    {t}
                  </span>
                ))}
              </div>
            )
          })()}

          {/* 里程碑进度 */}
          {MILESTONES.length > 0 && (
            <div className="flex gap8 mt8" style={{ flexWrap: 'wrap' }}>
              {MILESTONES.map((m) => {
                const done = (sim.reachedMilestones || []).includes(m.id)
                const near = sim.month >= m.month - 1 && !done
                return (
                  <span
                    key={m.id}
                    title={m.desc}
                    style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 8,
                      opacity: done ? 1 : 0.4,
                      background: done ? 'var(--gold)' : near ? '#E9F8F6' : '#f2efe8',
                      color: done ? '#fff' : 'var(--text-soft)',
                    }}
                  >
                    {done ? '✓ ' : near ? '🔔 ' : '🔒 '}{m.title}
                  </span>
                )
              })}
            </div>
          )}

          {(sim.totalDividend > 0 || (sim.usedTaxPlans || []).length) && (
            <div className="flex gap8 mt8">
              <div className="shop-stat" style={{ flex: 1, marginBottom: 0 }}>
                <span>💰 累计分红</span>
                <span className="v">¥{(sim.totalDividend || 0).toFixed(1)}万</span>
              </div>
              <div className="shop-stat" style={{ flex: 1, marginBottom: 0 }}>
                <span>🛡️ 合法筹划</span>
                <span className="v">
                  {(sim.usedTaxPlans || []).length
                    ? sim.usedTaxPlans.map((p) => p).join('/')
                    : '未使用'}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
