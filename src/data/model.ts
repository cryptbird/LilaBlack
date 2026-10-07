import type { EventType, MapId, MarkerType } from '../config'

export interface GameEvent {
  type: EventType
  /** Absolute time, epoch seconds (see loader for why the raw `ts` is seconds, not ms). */
  ts: number
  /** Seconds since the first event of the match. */
  t: number
  /** Minimap UV (0-1, v grows "north"/up). */
  u: number
  v: number
  /** Elevation, kept for tooltips. */
  y: number
}

export interface Journey {
  /** Source filename, unique per player-per-match. */
  key: string
  userId: string
  matchId: string
  mapId: MapId
  day: string
  isBot: boolean
  /** Movement samples, sorted by time. */
  path: GameEvent[]
  /** Discrete events (kills, deaths, loot), sorted by time. */
  events: GameEvent[]
  /** Display colour, assigned per match. */
  color: string
  /** Rows dropped as exact duplicates. */
  duplicates: number
}

export interface Match {
  id: string
  mapId: MapId
  day: string
  start: number
  end: number
  duration: number
  journeys: Journey[]
  humans: number
  bots: number
  counts: Record<MarkerType, number>
}

export interface Dataset {
  /** Where the data came from, shown in the header. */
  label: string
  journeys: Journey[]
  matches: Match[]
  matchById: Map<string, Match>
  days: string[]
  stats: { files: number; rows: number; duplicates: number; failed: string[] }
}
