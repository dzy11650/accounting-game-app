/**
 * 分享工具：把本局成绩生成文本卡片 + 复制/分享（纯前端，无后端）
 * 用于"把成绩分享给朋友"，替代纯本地存储
 */

// 生成分享文案
export function buildShareText(result, coName, projectName) {
  const stars = '⭐'.repeat(result.stars || 0) + '☆'.repeat(Math.max(0, 3 - (result.stars || 0)))
  const lines = [
    `🏢 我在《会计小当家》经营${coName}${projectName ? `·${projectName}` : ''}`,
    `${result.ok ? '✅ 通关！' : '💥 爆雷了…'}`,
    `📈 净利润 ¥${(result.profit || 0).toFixed(1)}万 ${stars}`,
    `📅 坚持 ${result.months || 0} 个月 · 接单 ${result.ordersFulfilled || 0} 笔`,
  ]
  if (result.milestones?.length) {
    lines.push(`🏁 里程碑：${result.milestones.map((m) => m.title).join('、')}`)
  }
  if ((result.scores?.compliance ?? 0) < 60) {
    lines.push('😈 我用过邪道，风险很高…你敢挑战正道通关吗？')
  } else {
    lines.push('🤝 全程正道经营！你来试试能不能零邪道通关')
  }
  lines.push('—— 会计小当家 · 零基础学会计')
  return lines.join('\n')
}

// 复制到剪贴板（带降级）
export async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return { ok: true }
    }
  } catch (e) {}
  // 降级：textarea 方式
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e }
  }
}

// 触发 Web Share API（移动端）
export async function shareText(text, title) {
  try {
    if (navigator.share) {
      await navigator.share({ title, text })
      return { ok: true, via: 'native' }
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return { ok: false, cancelled: true }
  }
  return { ok: false, fallback: true }
}
