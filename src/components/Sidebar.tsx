import { useMemo, useState } from 'react'
import { HEAT_LAYERS, MAPS, MAP_IDS, MARKERS, MARKER_TYPES, type HeatLayer, type MarkerType } from '../config'
import type { Match } from '../data/model'
import { fmtClock, fmtDay, fmtWallTime } from '../lib/format'
import { HEAT_GRADIENT_CSS } from '../lib/heatmap'
import type { ViewState } from '../lib/urlState'

type SortKey = 'time' | 'players' | 'combat' | 'duration'

interface Props {
  view: ViewState
  setView: (patch: Partial<ViewState>) => void
  allDays: string[]
  dayMatches: Match[]
  matchCountByMap: Record<string, number>
  heatOpacity: number
  setHeatOpacity: (o: number) => void
  heatCount: number
}

const combat = (m: Match) => m.counts.Kill + m.counts.Killed + m.counts.BotKill + m.counts.BotKilled + m.counts.KilledByStorm

export function Sidebar({ view, setView, allDays, dayMatches, matchCountByMap, heatOpacity, setHeatOpacity, heatCount }: Props) {
  const [sort, setSort] = useState<SortKey>('players')
  const [multiOnly, setMultiOnly] = useState(false)
  const [query, setQuery] = useState('')

  const days = view.days ?? allDays
  const toggleDay = (d: string) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort()
    setView({ days: next.length === allDays.length ? null : next, match: null })
  }
  const toggleMarker = (m: MarkerType) => {
    const has = view.markers.includes(m)
    setView({ markers: has ? view.markers.filter((x) => x !== m) : [...view.markers, m] })
  }

  const list = useMemo(() => {
    let ms = dayMatches
    if (multiOnly) ms = ms.filter((m) => m.journeys.length > 1)
    if (query.trim()) ms = ms.filter((m) => m.id.toLowerCase().includes(query.trim().toLowerCase()))
    const sorters: Record<SortKey, (a: Match, b: Match) => number> = {
      time: (a, b) => a.start - b.start,
      players: (a, b) => b.journeys.length - a.journeys.length || combat(b) - combat(a),
      combat: (a, b) => combat(b) - combat(a),
      duration: (a, b) => b.duration - a.duration,
    }
    return [...ms].sort(sorters[sort])
  }, [dayMatches, multiOnly, query, sort])

  return (
    <aside className="sidebar">
      <section data-tour="map">
        <h3>Map</h3>
        <div className="seg maps">
          {MAP_IDS.map((id) => (
            <button key={id} className={view.map === id ? 'on' : ''} onClick={() => setView({ map: id, match: null })}>
              {MAPS[id].label}
              <span className="count">{matchCountByMap[id] ?? 0}</span>
            </button>
          ))}
        </div>
      </section>

      <section data-tour="date">
        <h3>
          Date
          <button className="link" onClick={() => setView({ days: null, match: null })}>
            all
          </button>
        </h3>
        <div className="chips">
          {allDays.map((d) => (
            <button key={d} className={`chip ${days.includes(d) ? 'on' : ''}`} onClick={() => toggleDay(d)} title={d === '2026-02-14' ? 'Partial day — data collection was still ongoing' : undefined}>
              {fmtDay(d)}
              {d === '2026-02-14' && '*'}
            </button>
          ))}
        </div>
      </section>

      <section data-tour="show">
        <h3>Show</h3>
        <div className="toggles">
          <Toggle on={view.humans} onClick={() => setView({ humans: !view.humans })}>
            <span className="legend-line human" /> Humans
          </Toggle>
          <Toggle on={view.bots} onClick={() => setView({ bots: !view.bots })}>
            <span className="legend-line bot" /> Bots
          </Toggle>
          <Toggle on={view.paths} onClick={() => setView({ paths: !view.paths })}>
            Paths
          </Toggle>
        </div>
      </section>

      <section data-tour="events">
        <h3>Events</h3>
        <div className="marker-list">
          {MARKER_TYPES.map((m) => (
            <button key={m} className={`marker-row ${view.markers.includes(m) ? 'on' : ''}`} onClick={() => toggleMarker(m)} title={MARKERS[m].description}>
              <MarkerIcon type={m} />
              {MARKERS[m].label}
            </button>
          ))}
        </div>
      </section>

      <section data-tour="heatmap">
        <h3>Heatmap</h3>
        <div className="seg wrap">
          {HEAT_LAYERS.map((h) => (
            <button key={h.id} className={view.heat === h.id ? 'on' : ''} onClick={() => setView({ heat: h.id as HeatLayer })}>
              {h.label}
            </button>
          ))}
        </div>
        {view.heat !== 'none' && (
          <div className="heat-legend">
            <div className="heat-bar" style={{ background: HEAT_GRADIENT_CSS }} />
            <div className="heat-meta">
              <span>low</span>
              <span className="muted">{heatCount.toLocaleString()} events</span>
              <span>high</span>
            </div>
            <label className="slider-row">
              Opacity
              <input type="range" min={0.1} max={1} step={0.05} value={heatOpacity} onChange={(e) => setHeatOpacity(Number(e.target.value))} />
            </label>
          </div>
        )}
      </section>

      <section className="match-section" data-tour="matches">
        <h3>
          Matches <span className="muted">({list.length})</span>
        </h3>
        <div className="match-tools">
          <input placeholder="Search match id…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort matches">
            <option value="players">Most players</option>
            <option value="combat">Most combat</option>
            <option value="duration">Longest</option>
            <option value="time">Chronological</option>
          </select>
        </div>
        <label className="check">
          <input type="checkbox" checked={multiOnly} onChange={(e) => setMultiOnly(e.target.checked)} /> Only matches with 2+ recorded players
        </label>
        <div className="match-list">
          <button className={`match-row all ${view.match === null ? 'on' : ''}`} onClick={() => setView({ match: null })}>
            <div className="mr-top">
              <strong>All matches</strong>
              <span className="muted">{dayMatches.length} on this map</span>
            </div>
          </button>
          {list.map((m) => (
            <button key={m.id} className={`match-row ${view.match === m.id ? 'on' : ''}`} onClick={() => setView({ match: m.id })}>
              <div className="mr-top">
                <span className="mono">{m.id.slice(0, 8)}</span>
                <span className="muted">
                  {fmtDay(m.day)} {fmtWallTime(m.start)}
                </span>
              </div>
              <div className="mr-stats">
                <span title="Human players recorded">👤 {m.humans}</span>
                <span title="Bots recorded">🤖 {m.bots}</span>
                <span title="Match length">⏱ {fmtClock(m.duration)}</span>
                {combat(m) > 0 && <span title="Kills + deaths">⚔ {combat(m)}</span>}
                {m.counts.KilledByStorm > 0 && (
                  <span title="Storm deaths" className="storm">
                    ☁ {m.counts.KilledByStorm}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </section>
    </aside>
  )
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`toggle ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on}>
      {children}
    </button>
  )
}

export function MarkerIcon({ type }: { type: MarkerType }) {
  const { shape, color } = MARKERS[type]
  return (
    <svg width="14" height="14" viewBox="-7 -7 14 14" className="marker-icon" aria-hidden>
      {shape === 'cross' && (
        <g strokeLinecap="round">
          <path d="M-4,-4L4,4M4,-4L-4,4" stroke="#05070a" strokeWidth="4" />
          <path d="M-4,-4L4,4M4,-4L-4,4" stroke={color} strokeWidth="2.2" />
        </g>
      )}
      {shape === 'dot' && <circle r="4.5" fill={color} stroke="#fff" strokeWidth="1.4" />}
      {shape === 'diamond' && <path d="M0,-4.5L4.5,0L0,4.5L-4.5,0Z" fill={color} stroke="#05070a" />}
    </svg>
  )
}
