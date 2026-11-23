// What a connector tool call does, read from its name: the send guard's classification. Pure: no $.
// A send word wins over a draft word unless the name starts with a read verb (send_draft asks; get_post does not).
import { HUB_NAMES, HUB_WRITE_NAMES, lastSegment } from './hub'

const VERBS = 'send|reply|forward|post|publish|share|submit|invite|notify|broadcast|tweet'
const CAP = 'Send|Reply|Forward|Post|Publish|Share|Submit|Invite|Notify|Broadcast|Tweet'
const SEND_SNAKE_WORD = new RegExp(`(^|_)(${VERBS})(_|$)`)
const SEND_CAMEL_WORD = new RegExp(`^[a-z]*(${CAP})([A-Z0-9]|$)`)
const SEND_LEAD_WORD = new RegExp(`^(${VERBS})[A-Z]`)
const READ_LEAD = /^(get|list|search|read|find|fetch|lookup|describe|count|check|view|show|query|download|export|preview)(_|[A-Z]|$)/
const DRAFT_WORD = /(^|_)drafts?(_|$)|Drafts?([A-Z]|$)/
const WRITE_LEAD_WORD = /^(create|update|add|insert|upsert|edit|delete|remove|set|write|upload|move|rename|mark|apply|assign|archive|trash|label|merge)(_|[A-Z]|$)/

export type SendKind = 'hub-write' | 'send' | 'draft' | 'write' | 'other'

export function classify(full: string): SendKind {
  if (!full.startsWith('mcp__') || full.indexOf('__', 5) < 0) return 'other'
  const name = lastSegment(full)
  if (HUB_WRITE_NAMES.has(name)) return 'hub-write'
  if (HUB_NAMES.has(name)) return 'other'
  if (!READ_LEAD.test(name) && (SEND_SNAKE_WORD.test(name) || SEND_CAMEL_WORD.test(name) || SEND_LEAD_WORD.test(name))) return 'send'
  if (DRAFT_WORD.test(name)) return 'draft'
  if (READ_LEAD.test(name)) return 'other'
  if (WRITE_LEAD_WORD.test(name)) return 'write'
  return 'other'
}

/** A server-named tool is untrusted text: keep letters, digits and underscores, at most 64. */
export function safeToolName(name: string): string {
  return name.replace(/[^A-Za-z0-9_]/g, '').slice(0, 64)
}
