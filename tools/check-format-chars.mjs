// Source check, run outside the plugin: no text file of the plugin may hold an invisible format character (Unicode
// Cf: bidi controls, zero-width characters, a byte order mark) or a control character other than tab and line
// feed. Such a character in source is the Trojan Source pattern: an editor can show the code otherwise than it
// runs. Write one as an escape (a backslash, u, then the code point) instead. The plugin's own tests cannot read
// files, so this runs here.
// Usage: node tools/check-format-chars.mjs [plugin folder]   (default: nys-workers-comp-hub). Exit 1 on a find.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.argv[2] ?? 'nys-workers-comp-hub'
const TEXT = /\.(?:ts|tsx|mts|cts|js|mjs|cjs|jsx|json|md|txt|html|css|svg|yml|yaml)$/i
const BAD = /[\p{Cf}\u0000-\u0008\u000B-\u001F\u007F-\u009F]/u
const finds = []
let files = 0

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue
    const path = join(dir, name)
    const st = statSync(path)
    if (st.isDirectory()) { walk(path); continue }
    if (!TEXT.test(name)) continue
    files += 1
    const lines = readFileSync(path, 'utf8').split('\n')
    lines.forEach((line, i) => {
      for (const ch of line) {
        if (!BAD.test(ch)) continue
        const code = ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')
        finds.push(`${relative(process.cwd(), path)}:${i + 1}: U+${code}`)
      }
    })
  }
}

walk(root)
if (files === 0) { console.error(`check-format-chars: no text files under ${root}`); process.exit(2) }
if (finds.length > 0) {
  console.error(`check-format-chars: ${finds.length} format or control character(s) in ${root}:`)
  for (const f of finds.slice(0, 200)) console.error(`  ${f}`)
  process.exit(1)
}
console.log(`check-format-chars: ${files} text files under ${root}, none holds a format or control character.`)
