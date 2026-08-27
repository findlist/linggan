// 生成流程状态机：管理工作台一次生成的 idle → generating → success/error 流转。
// 业务规则与 UI 分离（规范 §11）：RemixWorkbench 消费 snapshot 渲染状态条，
// 防重复提交与耗时统计规则集中在这里，注入 now 时钟便于测试用固定时间验证。

export type GenerationStatus = 'idle' | 'generating' | 'success' | 'error'

export interface GenerationSnapshot {
  status: GenerationStatus
  /** 本次生成开始时间戳（ms）；idle 时为 null */
  startedAt: number | null
  /** 最近一次成功生成的真实耗时（ms）；尚未成功过为 null */
  elapsedMs: number | null
  /** 最近一次失败的可读原因 */
  error: string | null
}

export interface GenerationStatusMachine {
  snapshot: () => GenerationSnapshot
  /** 开始生成；generating 中重复调用返回 false（防双击/并发触发重复生成） */
  begin: () => boolean
  /** 完成生成并记录真实耗时；仅 generating 状态有效，返回是否生效 */
  complete: () => boolean
  /** 记录失败原因；任意状态可调用，空消息降级为「未知错误」 */
  fail: (message: string) => void
}

export const createGenerationStatus = (now: () => number = () => Date.now()): GenerationStatusMachine => {
  let state: GenerationSnapshot = { status: 'idle', startedAt: null, elapsedMs: null, error: null }
  return {
    snapshot: () => ({ ...state }),
    begin() {
      // 生成进行中拒绝再次开始：双击提交按钮只产生一次生成
      if (state.status === 'generating') return false
      state = { status: 'generating', startedAt: now(), elapsedMs: null, error: null }
      return true
    },
    complete() {
      if (state.status !== 'generating') return false
      const startedAt = state.startedAt ?? now()
      // 时钟回拨等异常时钳制为 0，避免向用户展示负耗时
      state = { ...state, status: 'success', elapsedMs: Math.max(0, now() - startedAt) }
      return true
    },
    fail(message: string) {
      state = { ...state, status: 'error', error: message?.trim() || '未知错误' }
    },
  }
}

/** 耗时展示：<1s 显示毫秒整数，≥1s 显示一位小数秒；无有效数据返回占位符 */
export const formatElapsed = (ms: number | null): string => {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return '—'
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`
}
