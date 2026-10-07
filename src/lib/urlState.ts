import { HEAT_LAYERS, MAP_IDS, MARKER_TYPES, type HeatLayer, type MapId, type MarkerType } from '../config'

/** The part of the view that is shareable via the URL hash. */
export interface ViewState {
  map: MapId
  days: string[] | null // null = all days
  match: string | null
  heat: HeatLayer
  humans: boolean
  bots: boolean
  paths: boolean
  markers: MarkerType[]
}

export const DEFAULT_VIEW: ViewState = {
  map: 'AmbroseValley',
  days: null,
  match: null,
  heat: 'none',
  humans: true,
  bots: true,
  paths: true,
  markers: MARKER_TYPES.filter((m) => m !== 'Loot'),
}

export function readHash(): ViewState {
  const p = new URLSearchParams(window.location.hash.slice(1))
  const map = p.get('map') as MapId
  const heat = p.get('heat') as HeatLayer
  const markers = p.get('markers')
  return {
    map: MAP_IDS.includes(map) ? map : DEFAULT_VIEW.map,
    days: p.get('days') ? p.get('days')!.split(',') : null,
    match: p.get('match'),
    heat: HEAT_LAYERS.some((h) => h.id === heat) ? heat : DEFAULT_VIEW.heat,
    humans: p.get('humans') !== '0',
    bots: p.get('bots') !== '0',
    paths: p.get('paths') !== '0',
    markers: markers !== null ? (markers.split(',').filter((m) => MARKER_TYPES.includes(m as MarkerType)) as MarkerType[]) : DEFAULT_VIEW.markers,
  }
}

export function writeHash(s: ViewState) {
  const p = new URLSearchParams()
  p.set('map', s.map)
  if (s.days) p.set('days', s.days.join(','))
  if (s.match) p.set('match', s.match)
  if (s.heat !== 'none') p.set('heat', s.heat)
  if (!s.humans) p.set('humans', '0')
  if (!s.bots) p.set('bots', '0')
  if (!s.paths) p.set('paths', '0')
  if (s.markers.join() !== DEFAULT_VIEW.markers.join()) p.set('markers', s.markers.join(','))
  history.replaceState(null, '', `#${p.toString()}`)
}
