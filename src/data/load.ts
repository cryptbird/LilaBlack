import { unzip, type Unzipped } from 'fflate'
import { parquetReadObjects } from 'hyparquet'
import { BOT_COLOR, HUMAN_COLORS, MAPS, MARKER_TYPES, MOVEMENT_EVENTS, type EventType, type MapId, type MarkerType } from '../config'
import type { Dataset, GameEvent, Journey, Match } from './model'

interface RawRow {
  user_id: string
  match_id: string
  map_id: string
  x: number
  y: number
  z: number
  ts: Date | number | bigint
  event: string | Uint8Array
}

const BASE = import.meta.env.BASE_URL
const CONCURRENCY = 24
const decoder = new TextDecoder()

/** Bots have short numeric user IDs; humans have UUIDs. */
export const isBotId = (userId: string) => /^\d+$/.test(userId)

/** World (x, z) -> minimap UV. y is elevation and is ignored for 2D plotting. */
export function worldToUV(mapId: MapId, x: number, z: number) {
  const m = MAPS[mapId]
  return { u: (x - m.originX) / m.scale, v: (z - m.originZ) / m.scale }
}

/**
 * The parquet column is typed TIMESTAMP(MILLIS) and so decodes to dates in Jan 1970.
 * The stored integers (~1.77e9) are actually Unix epoch *seconds* (Feb 10-14 2026),
 * which also gives sensible match lengths (~6 min) and a ~5s position sample rate.
 */
function tsSeconds(ts: RawRow['ts']): number {
  if (ts instanceof Date) return ts.getTime()
  return Number(ts)
}

function decodeEvent(e: RawRow['event']): EventType {
  return (typeof e === 'string' ? e : decoder.decode(e)) as EventType
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

/**
 * Day folders are named like "February_10". The year isn't in the name, so take it from the
 * data itself; if the folder name can't be parsed, fall back to the UTC date of the first event.
 */
function folderToIsoDay(folder: string, firstTs: number | undefined): string {
  const year = firstTs !== undefined ? new Date(firstTs * 1000).getUTCFullYear() : 2026
  const m = /^([A-Za-z]+)_(\d{1,2})$/.exec(folder)
  const month = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1
  if (m && month >= 0) return `${year}-${String(month + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`
  return firstTs !== undefined ? new Date(firstTs * 1000).toISOString().slice(0, 10) : folder
}

/** One player-journey file, wherever it came from (bundled fetch or uploaded zip). */
interface SourceFile {
  folder: string
  file: string
  read: () => Promise<ArrayBuffer>
}

async function parseFile(src: SourceFile): Promise<Journey> {
  const rows = (await parquetReadObjects({ file: await src.read() })) as unknown as RawRow[]
  if (!rows.length) throw new Error(`${src.file}: empty file`)

  const { user_id: userId, match_id: matchId } = rows[0]
  const mapId = rows[0].map_id as MapId
  if (!(mapId in MAPS)) throw new Error(`${src.file}: unknown map "${rows[0].map_id}"`)

  const seen = new Set<string>()
  const path: GameEvent[] = []
  const events: GameEvent[] = []
  let duplicates = 0
  for (const r of rows) {
    const type = decodeEvent(r.event)
    const ts = tsSeconds(r.ts)
    const dedupeKey = `${ts}|${type}|${r.x}|${r.y}|${r.z}`
    if (seen.has(dedupeKey)) {
      duplicates++
      continue
    }
    seen.add(dedupeKey)
    const { u, v } = worldToUV(mapId, r.x, r.z)
    const ev: GameEvent = { type, ts, t: 0, u, v, y: r.y }
    ;(MOVEMENT_EVENTS.has(type) ? path : events).push(ev)
  }
  const byTs = (a: GameEvent, b: GameEvent) => a.ts - b.ts
  path.sort(byTs)
  events.sort(byTs)

  return {
    key: `${src.folder}/${src.file}`,
    userId,
    matchId,
    mapId,
    day: folderToIsoDay(src.folder, tsSeconds(rows[0].ts)),
    isBot: isBotId(userId),
    path,
    events,
    color: BOT_COLOR,
    duplicates,
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>, onDone: () => void) {
  const results: (R | Error)[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      try {
        results[i] = await fn(items[i])
      } catch (err) {
        results[i] = err instanceof Error ? err : new Error(String(err))
      }
      onDone()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

function buildMatches(journeys: Journey[]): Match[] {
  const groups = new Map<string, Journey[]>()
  for (const j of journeys) {
    const g = groups.get(j.matchId)
    if (g) g.push(j)
    else groups.set(j.matchId, [j])
  }

  const matches: Match[] = []
  for (const [id, js] of groups) {
    let start = Infinity
    let end = -Infinity
    for (const j of js) {
      for (const list of [j.path, j.events]) {
        if (!list.length) continue
        start = Math.min(start, list[0].ts)
        end = Math.max(end, list[list.length - 1].ts)
      }
    }
    if (!Number.isFinite(start)) continue

    const counts = Object.fromEntries(MARKER_TYPES.map((m) => [m, 0])) as Record<MarkerType, number>
    let humanIdx = 0
    // Humans first so they get the most distinct colours.
    js.sort((a, b) => Number(a.isBot) - Number(b.isBot) || a.userId.localeCompare(b.userId))
    for (const j of js) {
      for (const e of j.path) e.t = e.ts - start
      for (const e of j.events) {
        e.t = e.ts - start
        counts[e.type as MarkerType]++
      }
      j.color = j.isBot ? BOT_COLOR : HUMAN_COLORS[humanIdx++ % HUMAN_COLORS.length]
    }

    matches.push({
      id,
      mapId: js[0].mapId,
      // One match straddles two day folders; file it under the earliest.
      day: js.map((j) => j.day).sort()[0],
      start,
      end,
      duration: end - start,
      journeys: js,
      humans: js.filter((j) => !j.isBot).length,
      bots: js.filter((j) => j.isBot).length,
      counts,
    })
  }
  return matches.sort((a, b) => a.start - b.start)
}

export type Progress = (done: number, total: number, stage: string) => void

async function buildDataset(sources: SourceFile[], label: string, onProgress: Progress): Promise<Dataset> {
  let done = 0
  onProgress(0, sources.length, 'Reading player journeys')
  const results = await mapLimit(sources, CONCURRENCY, parseFile, () => onProgress(++done, sources.length, 'Reading player journeys'))

  const journeys: Journey[] = []
  const failed: string[] = []
  results.forEach((r, i) => (r instanceof Error ? failed.push(`${sources[i].file}: ${r.message}`) : journeys.push(r)))
  if (failed.length) console.warn(`Skipped ${failed.length} files`, failed)

  const matches = buildMatches(journeys)
  return {
    label,
    journeys,
    matches,
    matchById: new Map(matches.map((m) => [m.id, m])),
    days: [...new Set(matches.map((m) => m.day))].sort(),
    stats: {
      files: journeys.length,
      rows: journeys.reduce((s, j) => s + j.path.length + j.events.length + j.duplicates, 0),
      duplicates: journeys.reduce((s, j) => s + j.duplicates, 0),
      failed,
    },
  }
}

/** The sample data shipped with the app (copied into public/data at build time). */
export async function loadBundledDataset(onProgress: Progress): Promise<Dataset> {
  onProgress(0, 0, 'Fetching file list')
  const manifest: { day: string; file: string }[] = await (await fetch(`${BASE}data/manifest.json`)).json()
  const sources = manifest.map(({ day, file }) => ({
    folder: day,
    file,
    read: async () => {
      const res = await fetch(`${BASE}data/${day}/${file}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.arrayBuffer()
    },
  }))
  return buildDataset(sources, 'Sample data (Feb 10–14)', onProgress)
}

/** Journey files inside a zip: any `<DayFolder>/<user>_<match>.nakama-N`, at any depth. */
const JOURNEY_PATH = /(?:^|\/)([^/]+)\/([^/]+_[^/]+\.nakama-\d+)$/

/**
 * Accepts a zip laid out like the original player_data.zip. Minimaps inside the zip are skipped
 * (the app ships web-sized copies), which also avoids inflating ~24 MB of images in the browser.
 */
export async function loadZipDataset(zip: File, onProgress: Progress): Promise<Dataset> {
  onProgress(0, 0, `Unzipping ${zip.name}`)
  const buf = new Uint8Array(await zip.arrayBuffer())
  const entries = await new Promise<Unzipped>((resolve, reject) =>
    unzip(buf, { filter: (f) => !f.name.includes('__MACOSX') && JOURNEY_PATH.test(f.name) }, (err, data) => (err ? reject(new Error(`Couldn't read ${zip.name} as a zip file (${err.message}).`)) : resolve(data))),
  )
  const sources: SourceFile[] = Object.entries(entries).map(([name, bytes]) => {
    const [, folder, file] = JOURNEY_PATH.exec(name)!
    return { folder, file, read: async () => bytes.slice().buffer }
  })
  if (!sources.length) throw new Error('No player journey files found. Expected folders like February_10/ containing *.nakama-0 files.')
  return buildDataset(sources, zip.name, onProgress)
}
