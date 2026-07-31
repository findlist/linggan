// 创作历史本地存储：自动记录每次用户主动生成的完整方案，保留最近 50 条，
// 支持回看、重新加载到工作台、单条删除和清空全部。
//
// 与收藏列表（store.js 的 saved）的区别：
// - 收藏：用户主动点击"收藏"保存的精选方案，上限 8 条，强调人工筛选价值
// - 历史：系统自动记录每次"生成"操作的完整方案，上限 50 条，强调可回看和复用
//
// 设计要点：
// - 只 import type 引入 RemixPlan，编译时擦除，不把 remix-engine 带入前端 bundle
// - localStorage 不可用时静默降级为内存数组，不阻塞生成流程
// - 超过上限时丢弃最旧条目（末尾），保证最近 50 条可回看
// - 同一 plan.id 再次记录时更新已有条目并移到最前，避免重复堆积

import type { RemixPlan } from '../generation/remix-engine.ts'
// 重新导出 RemixPlan：history.ts 是历史模块的公共入口，调用方无需直接依赖 remix-engine
export type { RemixPlan }

const HISTORY_KEY = 'linggan-creation-history'
export const MAX_HISTORY = 50

/** 重新加载到工作台所需的选择器上下文 */
export interface HistoryContext {
  characterAId: string
  characterBId: string
  momentId: string
  styleId: string
}

/** 一条创作历史记录：完整方案 + 上下文 + 种子 + 时间 */
export interface HistoryEntry {
  id: string
  title: string
  hook: string
  plan: RemixPlan
  context: HistoryContext
  seed: string
  createdAt: string
}

/** addHistory 的输入参数，由 RemixWorkbench 在生成后组装 */
export interface AddHistoryInput {
  plan: RemixPlan
  context: HistoryContext
  seed: string
}

// 读取并规范化 localStorage 中的历史记录；损坏数据降级为空数组
const readHistory = (): HistoryEntry[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is HistoryEntry => {
      if (!item || typeof item !== 'object') return false
      const entry = item as Record<string, unknown>
      return typeof entry.id === 'string' && typeof entry.title === 'string' && entry.plan != null
    })
  } catch {
    return []
  }
}

// 写入 localStorage；隐私模式或配额满时静默降级
const writeHistory = (entries: HistoryEntry[]): void => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
  } catch {
    // 静默降级：历史丢失但不阻塞生成操作
  }
}

/**
 * 记录一次生成：新条目插入最前，同 id 条目更新并移前，超过上限丢弃最旧。
 * 返回更新后的历史列表（只读副本）。
 */
export const addHistory = (input: AddHistoryInput, now: Date = new Date()): HistoryEntry[] => {
  const { plan, context, seed } = input
  const entry: HistoryEntry = {
    id: plan.id,
    title: plan.title,
    hook: plan.hook,
    plan,
    context,
    seed,
    createdAt: now.toISOString(),
  }
  const existing = readHistory()
  // 同 id 条目移除后重新插入最前，避免重复堆积
  const filtered = existing.filter((item) => item.id !== entry.id)
  const next = [entry, ...filtered].slice(0, MAX_HISTORY)
  writeHistory(next)
  return next
}

// 读取当前历史列表（只读副本，按时间倒序，最新在最前）
export const getHistory = (): HistoryEntry[] => readHistory()

// 历史记录数，供 UI 显示计数
export const getHistorySize = (): number => readHistory().length

// 按 id 删除单条历史记录，返回更新后的列表
export const removeHistory = (id: string): HistoryEntry[] => {
  const next = readHistory().filter((item) => item.id !== id)
  writeHistory(next)
  return next
}

// 清空全部历史记录
export const clearHistory = (): void => {
  writeHistory([])
}
