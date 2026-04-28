export function createServerLogger() {
  return {
    info(..._args: unknown[]) {},
    warn(..._args: unknown[]) {},
    error(..._args: unknown[]) {},
  }
}
