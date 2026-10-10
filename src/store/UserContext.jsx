import React, { createContext, useContext, useEffect, useReducer } from 'react'

const STORAGE_KEY = 'accounting_game_user_v1'

const defaultState = {
  name: '小会计',
  avatar: '🐱',
  coins: 0,
  exp: 0,
  level: 1,
  tier: 'primary', // primary | middle | senior
  completedLevels: [], // 历史保留字段（兼容）
  badges: [], // badge ids earned
  gameBestProfit: 0,
  companiesRun: [], // 已体验的公司类型 id
  runHistory: [], // H: 每局通关记录 { coId, coName, profit, stars, months, date }

  // —— 局外成长（meta-progression）——
  metaUnlockedTalents: [], // 用局外金币购买、永久解锁的天败 id
  metaXp: 0,                // 局外经验
  metaLevel: 1,            // 局外等级 = floor(metaXp/500)+1

  // —— 财务侦探战绩 ——
  detective: {
    totalGames: 0,
    totalScores: 0,
    bestScore: 0,
    streak: 0,
    badges: [],
    lastPlayed: null,
  },
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_COINS':
      return { ...state, coins: state.coins + action.amount }
    case 'ADD_EXP': {
      const exp = state.exp + action.amount
      const level = Math.floor(exp / 100) + 1
      return { ...state, exp, level }
    }
    case 'COMPLETE_LEVEL': {
      const done = state.completedLevels.includes(action.id)
        ? state.completedLevels
        : [...state.completedLevels, action.id]
      return { ...state, completedLevels: done }
    }
    case 'EARN_BADGE': {
      if (state.badges.includes(action.id)) return state
      return { ...state, badges: [...state.badges, action.id] }
    }
    case 'SET_GAME_BEST': {
      const best = Math.max(state.gameBestProfit, action.profit)
      let badges = state.badges
      if (best >= 500 && !badges.includes('boss500')) badges = [...badges, 'boss500']
      if (best >= 2000 && !badges.includes('tycoon')) badges = [...badges, 'tycoon']
      return { ...state, gameBestProfit: best, badges }
    }
    case 'SET_TIER':
      return { ...state, tier: action.tier }
    case 'COMPANY_RUN': {
      if (state.companiesRun.includes(action.id)) return state
      return { ...state, companiesRun: [...state.companiesRun, action.id] }
    }
    case 'RECORD_RUN': {
      // H: 记录一局通关成绩（用于本地排行榜与多公司对比）
      const run = {
        coId: action.coId,
        coName: action.coName,
        profit: +(action.profit || 0).toFixed(2),
        stars: action.stars || 0,
        months: action.months || 0,
        date: action.date || new Date().toISOString().slice(0, 10),
      }
      return { ...state, runHistory: [...state.runHistory, run] }
    }
    case 'SET_NAME':
      return { ...state, name: action.name, avatar: action.avatar || state.avatar }
    case 'UNLOCK_TALENT': {
      if ((state.metaUnlockedTalents || []).includes(action.id)) return state
      if (state.coins < action.cost) return state
      return { ...state, coins: state.coins - action.cost, metaUnlockedTalents: [...(state.metaUnlockedTalents || []), action.id] }
    }
    case 'ADD_META_XP':
      return { ...state, metaXp: state.metaXp + action.amount, metaLevel: Math.floor((state.metaXp + action.amount) / 500) + 1 }
    case 'DETECTIVE_RESULT': {
      const { score, passed } = action.payload
      const prev = state.detective || defaultState.detective
      const newStreak = passed ? prev.streak + 1 : 0
      const newBest = Math.max(prev.bestScore, score)
      let newBadges = [...(prev.badges || [])]
      if (passed && !newBadges.includes('detective_first')) newBadges.push('detective_first')
      if (newBest >= 95 && !newBadges.includes('detective_master')) newBadges.push('detective_master')
      if (newStreak >= 3 && !newBadges.includes('detective_streak3')) newBadges.push('detective_streak3')
      if ((prev.totalGames || 0) >= 9 && !newBadges.includes('detective_veteran')) newBadges.push('detective_veteran')
      return {
        ...state,
        detective: {
          totalGames: (prev.totalGames || 0) + 1,
          totalScores: (prev.totalScores || 0) + score,
          bestScore: newBest,
          streak: newStreak,
          badges: newBadges,
          lastPlayed: new Date().toISOString(),
        },
      }
    }
    case 'RESET':
      return { ...defaultState }
    default:
      return state
  }
}

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, defaultState, (init) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return { ...defaultState, ...JSON.parse(raw) }
    } catch (e) {}
    return init
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch (e) {}
  }, [state])

  return (
    <UserContext.Provider value={{ state, dispatch }}>{children}</UserContext.Provider>
  )
}

export function useUser() {
  const ctx = useContext(UserContext)

  if (!ctx) {
    console.warn(
      '[UserContext] useUser called outside UserProvider. Falling back to a safe default context to prevent a white screen.'
    )

    const noopDispatch = () => {}
    return {
      state: defaultState,
      dispatch: noopDispatch,
    }
  }

  return ctx
}
