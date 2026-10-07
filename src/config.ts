export type MapId = 'AmbroseValley' | 'GrandRift' | 'Lockdown'

export interface MapConfig {
  id: MapId
  label: string
  scale: number
  originX: number
  originZ: number
  image: string
}

// From the dataset README. World (x, z) -> UV: u = (x - originX) / scale, v = (z - originZ) / scale
export const MAPS: Record<MapId, MapConfig> = {
  AmbroseValley: { id: 'AmbroseValley', label: 'Ambrose Valley', scale: 900, originX: -370, originZ: -473, image: 'minimaps/AmbroseValley.jpg' },
  GrandRift: { id: 'GrandRift', label: 'Grand Rift', scale: 581, originX: -290, originZ: -290, image: 'minimaps/GrandRift.jpg' },
  Lockdown: { id: 'Lockdown', label: 'Lockdown', scale: 1000, originX: -500, originZ: -500, image: 'minimaps/Lockdown.jpg' },
}

export const MAP_IDS = Object.keys(MAPS) as MapId[]

export type EventType =
  | 'Position'
  | 'BotPosition'
  | 'Kill'
  | 'Killed'
  | 'BotKill'
  | 'BotKilled'
  | 'KilledByStorm'
  | 'Loot'

export const MOVEMENT_EVENTS: ReadonlySet<EventType> = new Set(['Position', 'BotPosition'])

/** Discrete (non-movement) events that get a marker on the map. */
export type MarkerType = Exclude<EventType, 'Position' | 'BotPosition'>

export type MarkerShape = 'cross' | 'dot' | 'diamond'

export interface MarkerStyle {
  label: string
  description: string
  color: string
  shape: MarkerShape
}

// Shape = what happened (cross: got a kill, dot: died, diamond: loot).
// Colour = who was involved (red: vs human, amber: vs bot, violet: storm, gold: item).
export const MARKERS: Record<MarkerType, MarkerStyle> = {
  Kill: { label: 'Kill (PvP)', description: 'Killed a human player', color: '#ff3b4e', shape: 'cross' },
  BotKill: { label: 'Kill (bot)', description: 'Killed a bot', color: '#ff9f1c', shape: 'cross' },
  Killed: { label: 'Death (PvP)', description: 'Killed by a human player', color: '#ff3b4e', shape: 'dot' },
  BotKilled: { label: 'Death (bot)', description: 'Killed by a bot', color: '#ff9f1c', shape: 'dot' },
  KilledByStorm: { label: 'Storm death', description: 'Caught by the storm', color: '#b46bff', shape: 'dot' },
  Loot: { label: 'Loot', description: 'Picked up an item', color: '#ffd84d', shape: 'diamond' },
}

export const MARKER_TYPES = Object.keys(MARKERS) as MarkerType[]

export type HeatLayer = 'none' | 'traffic' | 'kills' | 'deaths' | 'storm' | 'loot'

export const HEAT_LAYERS: { id: HeatLayer; label: string; events: EventType[] }[] = [
  { id: 'none', label: 'Off', events: [] },
  { id: 'traffic', label: 'Traffic', events: ['Position', 'BotPosition'] },
  { id: 'kills', label: 'Kills', events: ['Kill', 'BotKill'] },
  { id: 'deaths', label: 'Deaths', events: ['Killed', 'BotKilled', 'KilledByStorm'] },
  { id: 'storm', label: 'Storm deaths', events: ['KilledByStorm'] },
  { id: 'loot', label: 'Loot', events: ['Loot'] },
]

// Distinct colours for individual humans when a single match is selected.
export const HUMAN_COLORS = ['#3ee0ff', '#5cff8d', '#ff6bd6', '#7aa2ff', '#c4ff4d', '#ffffff']
export const BOT_COLOR = '#ff9f1c'
export const HUMAN_COLOR = '#3ee0ff'
