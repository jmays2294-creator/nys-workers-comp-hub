// What a connector tool call does, read from its name: the send guard's classification. Pure: no $.
// The last segment of the name is split into words, whatever the spelling (snake_case, kebab-case, camelCase,
// UPPER_SNAKE). A send word wins over a draft word unless the name is a draft by its first or last word, and a
// name that starts with a read verb is a read unless a send follows "and" (send_draft asks; get_post does not).
// It reads names only: a send inside a shell command, a browser or a general-purpose tool is not seen here.
import type { Guard } from '../types'
import { HUB_NAMES, HUB_WRITE_NAMES, lastSegment } from './hub'

const SEND: ReadonlySet<string> = new Set([
  'send', 'sends', 'sendmail', 'sendsms', 'reply', 'forward', 'post', 'publish', 'share', 'submit', 'invite', 'notify',
  'broadcast', 'tweet', 'fax', 'dm', 'push', 'deploy',
])
// Words that send only as the first word: email_client, text_client, comment_on_issue.
const SEND_LEAD: ReadonlySet<string> = new Set(['email', 'mail', 'text', 'sms', 'message', 'comment'])
const READ: ReadonlySet<string> = new Set([
  'get', 'list', 'search', 'read', 'find', 'fetch', 'lookup', 'describe', 'count', 'check', 'view', 'show', 'query',
  'download', 'export', 'preview',
])
const WRITE: ReadonlySet<string> = new Set([
  'create', 'update', 'add', 'insert', 'upsert', 'edit', 'delete', 'remove', 'set', 'write', 'upload', 'move', 'rename',
  'mark', 'apply', 'assign', 'archive', 'trash', 'label', 'merge',
])
// A make verb with a message noun first or last is a send: create_message, add_issue_comment, messages_create.
const MAKE: ReadonlySet<string> = new Set(['create', 'add', 'insert', 'new', 'schedule', 'update', 'edit', 'upsert'])
const MESSAGE: ReadonlySet<string> = new Set([
  'message', 'messages', 'post', 'posts', 'comment', 'comments', 'email', 'emails', 'mail', 'sms', 'chat', 'reply',
  'replies', 'invitation', 'tweet',
])
const DRAFT: ReadonlySet<string> = new Set(['draft', 'drafts'])
const DRAFT_MAKERS: ReadonlySet<string> = new Set(['create', 'update', 'save', 'new', 'add', 'edit', 'upsert'])

export type SendKind = 'hub-write' | 'send' | 'draft' | 'write' | 'other'

/** The words of a tool name's last segment, lower case: sendMessage, send-message and SEND_MESSAGE alike. */
export function wordsOf(name: string): string[] {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().split(/[^a-z0-9]+/).filter(w => w !== '')
}

export function classify(full: string): SendKind {
  if (!full.startsWith('mcp__') || full.indexOf('__', 5) < 0) return 'other'
  const name = lastSegment(full)
  if (HUB_WRITE_NAMES.has(name)) return 'hub-write'
  if (HUB_NAMES.has(name)) return 'other'
  const w = wordsOf(name)
  const first = w[0] ?? ''
  const last = w[w.length - 1] ?? ''
  const hasSend = w.some(x => SEND.has(x))
  const isSendLead = SEND.has(first) || SEND_LEAD.has(first)
  if (!isSendLead && (DRAFT.has(first) || DRAFT.has(last) || (DRAFT_MAKERS.has(first) && w.some(x => DRAFT.has(x)) && !hasSend))) return 'draft'
  if (isSendLead) return 'send'
  if (READ.has(first)) {
    const and = w.indexOf('and')
    return and > 0 && w.slice(and + 1).some(x => SEND.has(x)) ? 'send' : 'other'
  }
  if (hasSend) return 'send'
  if (first === 'request' && w.includes('access')) return 'send'
  if (w.some(x => MAKE.has(x)) && (MESSAGE.has(first) || MESSAGE.has(last))) return 'send'
  if (w.some(x => DRAFT.has(x))) return 'draft'
  if (WRITE.has(first)) return 'write'
  return 'other'
}

/** classify, never throwing: a name it cannot read counts as a send. */
export function classifySafely(full: unknown): SendKind {
  try { return typeof full === 'string' ? classify(full) : 'other' } catch { return 'send' }
}

/**
 * What the guard does with a call: hand on the verdict beneath ('beneath'), put it to the person ('ask'), or refuse
 * it ('deny'). A send that goes straight out (a settings hook's own call: nobody is asked, and an ask would let it
 * run) is refused.
 */
export function guardVerdict(kind: SendKind, guard: Guard, isHubWork: boolean, isStraightOut: boolean): 'beneath' | 'ask' | 'deny' {
  const asks = kind === 'hub-write'
    || (kind === 'send' && guard !== 'hub-only')
    || (kind === 'write' && guard === 'sends-and-writes' && isHubWork)
  if (!asks) return 'beneath'
  return isStraightOut && kind !== 'write' ? 'deny' : 'ask'
}

/** A server-named tool is untrusted text: keep letters, digits and underscores, at most 64. */
export function safeToolName(name: string): string {
  return name.replace(/[^A-Za-z0-9_]/g, '').slice(0, 64)
}
