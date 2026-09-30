/**
 * 统一错误对象：避免各 catch 里手写字符串拼接
 */
export class GameRuntimeError extends Error {
  constructor(op, e) {
    super(`[${op}] ${e?.message || e}\n${e?.stack || ''}`)
    this.op = op
    this.cause = e
  }
}
