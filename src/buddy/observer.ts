import type { Message } from '../types/message.js';
import { getContentText } from '../utils/messages.js';

const SUCCESS_REACTIONS = [
  'That landed nicely.',
  'Cute. We made real progress.',
  'I like this direction.',
];

const ERROR_REACTIONS = [
  'Oof. That one fought back.',
  'Messy, but we can recover.',
  'Okay, that snag was rude.',
];

const THINKING_REACTIONS = [
  'Still chewing on that.',
  'There is a thread here.',
  'I am keeping an eye on it.',
];

function chooseReaction(pool: readonly string[], seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length]!;
}

function summarizeLatestTurn(messages: Message[]): string | undefined {
  const latest = messages.at(-1);
  if (!latest) return undefined;

  if (latest.type === 'assistant') {
    const text = getContentText(latest.message.content)?.toLowerCase() ?? '';
    if (latest.isApiErrorMessage || latest.apiError || /\berror\b|\bfailed\b|\bunable\b/.test(text)) {
      return chooseReaction(ERROR_REACTIONS, latest.uuid);
    }
    if (/\bdone\b|\bfixed\b|\bimplemented\b|\bupdated\b|\bresolved\b/.test(text)) {
      return chooseReaction(SUCCESS_REACTIONS, latest.uuid);
    }
    if (text.length > 0) {
      return chooseReaction(THINKING_REACTIONS, latest.uuid);
    }
    return undefined;
  }

  if (latest.type === 'system') {
    const text = (latest.content ?? latest.message ?? '').toLowerCase();
    if (latest.level === 'error' || /\berror\b|\bfailed\b/.test(text)) {
      return chooseReaction(ERROR_REACTIONS, latest.uuid);
    }
    if (text.length > 0) {
      return chooseReaction(THINKING_REACTIONS, latest.uuid);
    }
  }

  if (latest.type === 'attachment') {
    const text = typeof latest.attachment.message === 'string' ? latest.attachment.message.toLowerCase() : '';
    if (/\berror\b|\bfailed\b/.test(text)) {
      return chooseReaction(ERROR_REACTIONS, latest.uuid);
    }
  }

  return undefined;
}

export async function fireCompanionObserver(
  messages: Message[],
  onReaction: (reaction: string | undefined) => void,
): Promise<void> {
  onReaction(summarizeLatestTurn(messages));
}
