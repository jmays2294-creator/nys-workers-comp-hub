// What a connector tool call does, read from its name: the send guard's classification. Pure: no $.
// The last segment of the name is split into words, whatever the spelling (snake_case, kebab-case, camelCase,
// UPPER_SNAKE). In order:
// - "and" followed by a send is a send: check_and_send, draft_and_send, save_and_send_draft.
// - A draft is a draft: a name that starts with a draft word or a draft maker (draft_reply, create_reply_draft),
//   unless a send verb proper follows (drafts_send, draft_send_email); a name that ends with a draft word
//   (slack_send_message_draft), unless a send verb proper stands right before it (GMAIL_SEND_DRAFT).
// - A read about a send is a read: a last word such as status, logs or count right after the one send word
//   (push_status, deploy_logs, post_count), unless that word sends the thing (send_logs, post_status), and a
//   prepare before every send word (tiktok_prepare_publish).
// - A send word, a deploy, or a post of a message, thread, issue or review is a send; a name that starts with a
//   read verb is a read (get_post, get_deployment).
// It reads names only: a send inside a shell command, a browser or a general-purpose tool is not seen here.
import type { Guard } from '../types'
import { HUB_NAMES, HUB_WRITE_NAMES, lastSegment } from './hub'

const SEND: ReadonlySet<string> = new Set([
  'send', 'sends', 'sendmail', 'sendsms', 'reply', 'forward', 'post', 'publish', 'share', 'submit', 'invite', 'notify',
  'broadcast', 'tweet', 'fax', 'dm', 'push', 'deploy',
])
// The send verbs proper. They count before a draft word; reply, post and forward after "draft" are nouns (draft_reply).
const SEND_PROPER: ReadonlySet<string> = new Set(['send', 'sends', 'sendmail', 'sendsms', 'submit', 'publish'])
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
// A thread, an issue or a review that is started, created or written is a post: start_board_thread, issue_write,
// pull_request_review_write. Resolving or reading one is not (resolve_review_thread, issue_read).
const THREAD_MAKE: ReadonlySet<string> = new Set(['start', 'create', 'write', 'new'])
const THREAD: ReadonlySet<string> = new Set(['thread', 'threads', 'issue', 'issues', 'review', 'reviews'])
// A deploy: a deploy verb anywhere (request_promote, request_rollback); a deployment, release or publication that
// is created, started, approved, completed or confirmed (create_deployment, start_rolling_release,
// confirm_project_publication_review). Cancelling or configuring one is not (cancel_deployment).
const DEPLOY_VERB: ReadonlySet<string> = new Set(['promote', 'rollback', 'redeploy'])
const DEPLOY_NOUN: ReadonlySet<string> = new Set(['deployment', 'deployments', 'release', 'releases', 'publication'])
const DEPLOY_START: ReadonlySet<string> = new Set(['create', 'start', 'new', 'trigger', 'run', 'approve', 'complete', 'confirm'])
// A last word that names a read about a send, each with the words before it that send the thing itself; "send"
// always does (send_logs, send_history).
const SENDS_IT = ['send', 'sends', 'sendmail', 'sendsms']
const LOG_SENDERS: ReadonlySet<string> = new Set([...SENDS_IT, 'post', 'forward', 'share', 'submit', 'push'])
const READ_NOUN: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['status', new Set([...SENDS_IT, 'post', 'tweet', 'broadcast', 'notify', 'dm'])],
  ['logs', LOG_SENDERS], ['log', LOG_SENDERS],
  ['preview', new Set([...SENDS_IT, 'share', 'forward'])],
  ['count', new Set(SENDS_IT)], ['history', new Set(SENDS_IT)], ['settings', new Set(SENDS_IT)],
])
const DRAFT: ReadonlySet<string> = new Set(['draft', 'drafts'])
const DRAFT_MAKERS: ReadonlySet<string> = new Set(['create', 'update', 'save', 'new', 'add', 'edit', 'upsert'])

export type SendKind = 'hub-write' | 'send' | 'draft' | 'write' | 'other'

/** Whose settings hook made a call, as the host tells it (`next.origin.hookOwner`); absent on every other call. */
export type HookOwner = 'organization' | 'unknown' | 'person' | undefined

/** The words of a tool name's last segment, lower case: sendMessage, send-message and SEND_MESSAGE alike. */
export function wordsOf(name: string): string[] {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().split(/[^a-z0-9]+/).filter(w => w !== '')
}

function isSendWord(x: string, at: number): boolean {
  return SEND.has(x) || DEPLOY_VERB.has(x) || (at === 0 && SEND_LEAD.has(x))
}

export function classify(full: string): SendKind {
  if (!full.startsWith('mcp__') || full.indexOf('__', 5) < 0) return 'other'
  const name = lastSegment(full)
  if (HUB_WRITE_NAMES.has(name)) return 'hub-write'
  if (HUB_NAMES.has(name)) return 'other'
  const w = wordsOf(name)
  const first = w[0] ?? ''
  const last = w[w.length - 1] ?? ''
  const beforeLast = w[w.length - 2] ?? ''
  const and = w.indexOf('and')
  if (and > 0 && w.slice(and + 1).some(x => SEND.has(x) || DEPLOY_VERB.has(x))) return 'send'
  const isSendLead = SEND.has(first) || SEND_LEAD.has(first)

  if (!isSendLead && w.some(x => DRAFT.has(x))) {
    if (DRAFT.has(first) || DRAFT_MAKERS.has(first)) return w.some(x => SEND_PROPER.has(x)) ? 'send' : 'draft'
    if (DRAFT.has(last)) return SEND_PROPER.has(beforeLast) ? 'send' : 'draft'
  }

  const sendAt = w.findIndex((x, i) => isSendWord(x, i))
  if (sendAt >= 0 && !WRITE.has(first) && !MAKE.has(first)) {
    const prepare = w.indexOf('prepare')
    if (prepare >= 0 && prepare < sendAt) return 'other'
    const senders = READ_NOUN.get(last)
    if (senders !== undefined && sendAt === w.length - 2 && !senders.has(beforeLast)) return 'other'
  }

  if (isSendLead) return 'send'
  if (READ.has(first)) return 'other'
  if (sendAt >= 0) return 'send'
  if (w.some(x => DEPLOY_NOUN.has(x)) && w.some(x => DEPLOY_START.has(x))) return 'send'
  if (first === 'request' && w.includes('access')) return 'send'
  if (w.some(x => MAKE.has(x)) && (MESSAGE.has(first) || MESSAGE.has(last))) return 'send'
  if (w.some(x => THREAD_MAKE.has(x)) && (THREAD.has(first) || THREAD.has(last) || (THREAD_MAKE.has(last) && THREAD.has(beforeLast)))) return 'send'
  if (w.some(x => DRAFT.has(x))) return 'draft'
  if (WRITE.has(first)) return 'write'
  return 'other'
}

/** classify, never throwing: a name it cannot read counts as a send. */
export function classifySafely(full: unknown): SendKind {
  try { return typeof full === 'string' ? classify(full) : 'other' } catch { return 'send' }
}

/**
 * Whether a call goes straight to its server: a settings `mcp_tool` hook's own call, which carries no call id and
 * no approver. Nobody is asked about such a call, so an ask would let it run.
 */
export function isStraightOut(e: { readonly tool_use_id?: string; readonly approver?: string }, origin: { readonly plugin: string }): boolean {
  return e.tool_use_id === undefined && e.approver === undefined && typeof origin.plugin === 'string' && origin.plugin.startsWith('hook:')
}

/** Whose settings hook it is: the organization's where the host says so in either of its fields. */
export function hookOwnerOf(origin: { readonly hookOwner?: HookOwner; readonly isOrganizations?: true }): HookOwner {
  return origin.isOrganizations === true ? 'organization' : origin.hookOwner
}

/**
 * What the guard does with a call: hand on the verdict beneath ('beneath'), put it to the person ('ask'), or refuse
 * it ('deny'). A send that goes straight out is refused, unless the organization's own settings hook made it: that
 * hook keeps the organization's rules, so its call gets the verdict beneath. A person's own settings hook, or one
 * whose owner cannot be told, is refused.
 */
export function guardVerdict(kind: SendKind, guard: Guard, isHubWork: boolean, isStraightOutCall: boolean, hookOwner?: HookOwner): 'beneath' | 'ask' | 'deny' {
  const asks = kind === 'hub-write'
    || (kind === 'send' && guard !== 'hub-only')
    || (kind === 'write' && guard === 'sends-and-writes' && isHubWork)
  if (!asks) return 'beneath'
  if (!isStraightOutCall) return 'ask'
  if (hookOwner === 'organization') return 'beneath'
  return kind === 'write' ? 'ask' : 'deny'
}

/** A server-named tool is untrusted text: keep letters, digits and underscores, at most 64. */
export function safeToolName(name: string): string {
  return name.replace(/[^A-Za-z0-9_]/g, '').slice(0, 64)
}
