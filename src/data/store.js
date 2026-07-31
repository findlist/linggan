// 本地状态管理：把原本散落在 main.js 顶层的可变状态集中到 store，
// 减少 DOM 直接读取全局变量；saved 与 localStorage 同步，避免各 section 各自处理。
//
// store 持有的状态都是跨 section 共享的：
//   - duration / generation / currentResult / activeTab / libraryFilters：工作台与素材库使用
//   - saved：RemixWorkbench 写入、SavedList 渲染、RemixWorkbench 做 C3 检测时读取
// 单个 section 内部使用的临时状态仍留在该 section 模块内。

const SAVED_KEY = 'linggan-saved-remixes'

// 读取并规范化本地存储中的收藏；旧数据可能缺 plan/context/savedAt 字段，降级显示
const loadSaved = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]')
    return raw.map(item => ({
      id: item.id,
      title: item.title,
      hook: item.hook,
      plan: item.plan ?? null,
      context: item.context ?? null,
      savedAt: item.savedAt ?? null
    }))
  } catch {
    return []
  }
}

const state = {
  duration: 30,
  generation: 0,
  currentResult: null,
  activeTab: 'characters',
  // C5：筛选状态——维度 key → 选中的值列表；切换 tab 时重置为空对象
  libraryFilters: {},
  saved: loadSaved()
}

// 读取当前状态快照（直接返回引用，调用方不应修改 saved 等数组，必须走 setter）
export const getState = () => state

// 通用 patch：浅合并 partial 到 state，便于一次性更新多个字段
export const patch = (partial) => Object.assign(state, partial)

// saved 专用 setter：写入新数组并同步 localStorage，避免调用方忘记同步
export const setSaved = (next) => {
  state.saved = Array.isArray(next) ? next : []
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(state.saved))
  } catch {
    // localStorage 不可用（隐私模式 / 配额满）时静默降级，不影响运行
  }
  return state.saved
}

// 单字段快捷 setter
export const setDuration = (value) => { state.duration = value }
export const setGeneration = (value) => { state.generation = value }
export const incrementGeneration = () => { state.generation += 1; return state.generation }
export const setCurrentResult = (result) => { state.currentResult = result }
export const setActiveTab = (tab) => { state.activeTab = tab }
export const setLibraryFilters = (filters) => { state.libraryFilters = filters ?? {} }
export const resetLibraryFilters = () => { state.libraryFilters = {} }
