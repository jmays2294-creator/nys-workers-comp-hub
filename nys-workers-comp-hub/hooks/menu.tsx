// Rows in the desktop app's right-click menu. Built in one hook from what was clicked and one read of this
// session's figures; nothing slow. Each row copies or puts a question in the prompt; none sends anything.
import { atom, read } from 'claude-code'
import type { EngineInterface, PluginOptions, RenderElement, RenderInput, UiPressArgument } from 'claude-code'
import { copyOut, insertPrompt } from './actions'
import { COPY } from './copy'
import { copyText } from './hub'

const figures = atom({ plugin: 'nys-workers-comp-hub', key: 'figures' } as const, [], { shape: 'figures-1' })

// A WCB form only when it is the whole selection (EC2 or DB2 inside code is not a form question).
const FORM = /^(?:C|OC|RB|PH|EC|HP|DB|SH|IME|MG|VF)-?\d{1,4}(?:\.\d{1,2})?$/i
const DATE = /\b(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/
// A claimant label as attorneys write it (A. Garcia, A Garcia): never sent to the Hub's glossary.
const NAME_LABEL = /^[A-Z]\.?\s?[A-Z][a-z]+/

/** The menu's rows (at most three), or null for none. */
export async function drawMenu($: EngineInterface, e: RenderInput<'ContextMenu'>, options: PluginOptions): Promise<RenderElement | null> {
  if (e.surface !== 'desktop' || options.menu_rows === false) return null
  const { Box, Button, Text } = $.ui.resolve(e)
  const rows: RenderElement[] = []
  const id = e.props.row?.component === 'ToolUse' ? e.props.row.requestId : undefined
  const fig = id === undefined ? undefined : (await read($, figures)).find(f => f.id === id && f.status === 'done')
  if (fig !== undefined) {
    rows.push(<Button key="menu-copy" onPress={(press: UiPressArgument) => copyOut($, copyText(fig), press.surface, null)}>{COPY.menuCopy} <Text dimColor>{COPY.menuCopySub}</Text></Button>)
    rows.push(<Button key="menu-ask" onPress={() => insertPrompt($, COPY.fillAskFigure(fig.title))}>{COPY.menuAsk} <Text dimColor>{COPY.menuFillSub}</Text></Button>)
  }
  const raw = e.props.selection?.text
  const sel = typeof raw === 'string' ? raw.trim() : ''
  if (sel.length >= 1 && sel.length <= 80 && !/[\r\n]/.test(sel)) {
    const form = FORM.exec(sel)?.[0]
    const date = DATE.exec(sel)?.[1]
    const words = sel.split(/\s+/).length
    const isTerm = words <= 4 && !NAME_LABEL.test(sel)
    if (form !== undefined) rows.push(<Button key="menu-form" onPress={() => insertPrompt($, COPY.fillForm(form))}>{COPY.menuForm(form)} <Text dimColor>{COPY.menuFillSub}</Text></Button>)
    if (date !== undefined) rows.push(<Button key="menu-rate" onPress={() => insertPrompt($, `/nys-workers-comp-hub:max-rate ${date}`)}>{COPY.menuRate(date)} <Text dimColor>{COPY.menuFillSub}</Text></Button>)
    if (isTerm) rows.push(<Button key="menu-define" onPress={() => insertPrompt($, COPY.fillDefine(sel))}>{COPY.menuDefine} <Text dimColor>{COPY.menuFillSub}</Text></Button>)
  }
  if (rows.length === 0) return null
  return <Box flexDirection="column">{rows.slice(0, 3)}</Box>
}
