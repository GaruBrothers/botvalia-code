const mailboxWaiters = new Map<string, Set<(reason: MailboxWakeReason) => void>>()

export type MailboxWakeReason = 'message' | 'timeout' | 'aborted'

type MailboxWakeParams = {
  agentName: string
  teamName?: string
  timeoutMs: number
  signal?: AbortSignal
}

function getMailboxWakeKey(agentName: string, teamName?: string): string {
  return `${teamName || 'default'}::${agentName}`
}

export function notifyMailboxWakeup(
  agentName: string,
  teamName?: string,
): void {
  const key = getMailboxWakeKey(agentName, teamName)
  const waiters = mailboxWaiters.get(key)
  if (!waiters || waiters.size === 0) {
    return
  }

  mailboxWaiters.delete(key)
  for (const resolve of waiters) {
    resolve('message')
  }
}

export async function waitForMailboxWakeup({
  agentName,
  teamName,
  timeoutMs,
  signal,
}: MailboxWakeParams): Promise<MailboxWakeReason> {
  if (signal?.aborted) {
    return 'aborted'
  }

  const key = getMailboxWakeKey(agentName, teamName)

  return await new Promise(resolve => {
    let settled = false
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined

    const finish = (reason: MailboxWakeReason) => {
      if (settled) {
        return
      }
      settled = true

      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
      }

      const waiters = mailboxWaiters.get(key)
      if (waiters) {
        waiters.delete(finish)
        if (waiters.size === 0) {
          mailboxWaiters.delete(key)
        }
      }

      if (signal) {
        signal.removeEventListener('abort', onAbort)
      }

      resolve(reason)
    }

    const onAbort = () => finish('aborted')

    const waiters = mailboxWaiters.get(key) ?? new Set()
    waiters.add(finish)
    mailboxWaiters.set(key, waiters)

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true })
    }

    timeoutHandle = setTimeout(() => finish('timeout'), timeoutMs)
  })
}
