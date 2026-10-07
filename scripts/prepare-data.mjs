// Copies the raw telemetry (unchanged) into public/ so the browser can fetch it,
// writes a manifest of files, and makes web-sized copies of the minimaps.
// No data is transformed here — all parsing/cleaning happens in the browser.
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const SRC = path.resolve('player_data')
const OUT = path.resolve('public/data')
const MINI_OUT = path.resolve('public/minimaps')
const MINIMAP_SIZE = 2048

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
fs.mkdirSync(MINI_OUT, { recursive: true })

const days = fs.readdirSync(SRC).filter((d) => /^February_\d+$/.test(d)).sort()
const manifest = []
for (const day of days) {
  fs.mkdirSync(path.join(OUT, day))
  for (const file of fs.readdirSync(path.join(SRC, day)).sort()) {
    if (!file.endsWith('.nakama-0')) continue
    fs.copyFileSync(path.join(SRC, day, file), path.join(OUT, day, file))
    manifest.push({ day, file })
  }
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest))
console.log(`Copied ${manifest.length} files across ${days.length} days`)

// Source minimaps are 4320², 2160×2158 and 9000² (README says 1024²). The coordinate
// mapping works in UV space, so we only need a square, web-sized copy.
for (const name of ['AmbroseValley', 'GrandRift', 'Lockdown']) {
  const src = fs.readdirSync(path.join(SRC, 'minimaps')).find((f) => f.startsWith(name))
  const dst = path.join(MINI_OUT, `${name}.jpg`)
  if (fs.existsSync(dst)) continue
  try {
    execSync(`sips -s format jpeg -s formatOptions 82 -z ${MINIMAP_SIZE} ${MINIMAP_SIZE} "${path.join(SRC, 'minimaps', src)}" --out "${dst}"`, { stdio: 'ignore' })
    console.log(`Resized ${src} -> ${path.basename(dst)}`)
  } catch {
    console.warn(`Could not resize ${src} (sips unavailable); commit pre-resized minimaps instead`)
  }
}
