/**
 * localStorage 存档工具：版本号 + 迁移函数 + 错误处理
 */
const SAVE_KEY = 'accounting_game_save_v1'
export const SAVE_VERSION = 1

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    let s = JSON.parse(raw)
    s = migrate(s)
    return s && s.sim && s.coId ? s : null
  } catch (e) {
    console.warn('[loadSave] 存档读取/解析失败', e)
    return null
  }
}

export function writeSave(snap) {
  try {
    snap.version = SAVE_VERSION
    snap.savedAt = snap.savedAt || Date.now()
    localStorage.setItem(SAVE_KEY, JSON.stringify(snap))
  } catch (e) {
    console.warn('[writeSave] 存档写入失败', e)
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY) } catch (e) {}
}

/**
 * 存档迁移：旧版本 → 当前版本
 * @param {object} s 解析出的存档对象（可能缺失新字段）
 * @returns {object} 补齐默认字段后的对象
 */
export function migrate(s) {
  if (!s || typeof s !== 'object') return s
  if (s.version === undefined) s.version = 1
  // roguelike 天赋字段：旧档补默认值
  if (s.sim) {
    if (!Array.isArray(s.sim.talents)) s.sim.talents = []
    if (!Array.isArray(s.sim.synergies)) s.sim.synergies = []
    if (s.sim.rescueLimit == null) s.sim.rescueLimit = 1
    if (s.sim.rescues == null) s.sim.rescues = 0
  }
  return s
}
