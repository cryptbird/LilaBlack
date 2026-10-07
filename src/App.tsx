import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DetailsPanel } from './components/DetailsPanel'
import { MapCanvas } from './components/MapCanvas'
import { Sidebar } from './components/Sidebar'
import { Timeline } from './components/Timeline'
import { shouldAutoStartTour, Tour, TOUR_STEPS } from './components/Tour'
import { HEAT_LAYERS, MAPS, MOVEMENT_EVENTS, type EventType } from './config'
import { loadBundledDataset, loadZipDataset, type Progress } from './data/load'
import type { Dataset, Journey } from './data/model'
import { useFullscreen } from './lib/fullscreen'
import { HeatGrid, renderHeat } from './lib/heatmap'
import { readHash, writeHash, type ViewState } from './lib/urlState'

interface LoadState {
  done: number
  total: number
  stage: string
}

export default function App() {
  const [data, setData] = useState<Dataset | null>(null)
  const [loading, setLoading] = useState<LoadState | null>({ done: 0, total: 0, stage: 'Starting' })
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const run = useCallback((load: (p: Progress) => Promise<Dataset>) => {
    setError(null)
    setLoading({ done: 0, total: 0, stage: 'Starting' })
    load((done, total, stage) => setLoading({ done, total, stage }))
      .then((d) => {
        if (!d.journeys.length) throw new Error('No readable player journeys found in that data.')
        setData(d)
        setVersion((v) => v + 1)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(null))
  }, [])

  useEffect(() => run(loadBundledDataset), [run])

  const onUpload = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setError(`"${file.name}" is not a .zip file.`)
        return
      }
      // A new dataset means old match links are meaningless.
      history.replaceState(null, '', '#')
      run((p) => loadZipDataset(file, p))
    },
    [run],
  )

  // Drag-and-drop a zip anywhere on the page
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      setDragging(true)
    }
    const leave = (e: DragEvent) => {
      if (e.relatedTarget === null) setDragging(false)
    }
    const drop = (e: DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const f = e.dataTransfer?.files[0]
      if (f) onUpload(f)
    }
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [onUpload])

  return (
    <>
      {data ? (
        <Explorer key={version} data={data} onUpload={onUpload} />
      ) : (
        !loading && (
          <div className="splash">
            <div className="brand">
              LILA <span>BLACK</span>
            </div>
            <UploadButton onUpload={onUpload} />
          </div>
        )
      )}
      {loading && <LoadingOverlay state={loading} solid={!data} />}
      {error && (
        <div className="toast" role="alert">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}
      {dragging && <div className="drop-zone">Drop a player_data .zip to load it</div>}
    </>
  )
}

function LoadingOverlay({ state, solid }: { state: LoadState; solid: boolean }) {
  const pct = state.total ? (state.done / state.total) * 100 : 0
  return (
    <div className={`splash overlay ${solid ? 'solid' : ''}`}>
      <div className="brand">
        LILA <span>BLACK</span>
      </div>
      <div className="splash-sub">{state.stage}…</div>
      <div className="progress">
        <div style={{ width: `${pct}%` }} />
      </div>
      <div className="muted mono">{state.total ? `${state.done} / ${state.total}` : '\u00a0'}</div>
    </div>
  )
}

function UploadButton({ onUpload }: { onUpload: (f: File) => void }) {
  return (
    <label className="upload-btn" data-tour="upload" title="Load another player_data .zip (same layout as the original)">
      <input
        type="file"
        accept=".zip,application/zip"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onUpload(f)
          e.target.value = ''
        }}
      />
      ⇪ Upload data (.zip)
    </label>
  )
}

function Explorer({ data, onUpload }: { data: Dataset; onUpload: (f: File) => void }) {
  const viewFromHash = useCallback((): ViewState => {
    const v = readHash()
    // A shared link to a match should open on that match's map.
    const m = v.match ? data.matchById.get(v.match) : undefined
    return m ? { ...v, map: m.mapId } : { ...v, match: null }
  }, [data])
  const [view, setViewState] = useState<ViewState>(viewFromHash)
  const setView = useCallback((patch: Partial<ViewState>) => setViewState((v) => ({ ...v, ...patch })), [])
  useEffect(() => writeHash(view), [view])
  useEffect(() => {
    const onHash = () => setViewState(viewFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [viewFromHash])

  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(10)
  const [heatOpacity, setHeatOpacity] = useState(0.75)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [highlight, setHighlight] = useState<string | null>(null)
  const [tourOpen, setTourOpen] = useState(shouldAutoStartTour)
  const stageRef = useRef<HTMLElement>(null)
  const { isFullscreen, toggle: toggleFullscreen, exit: exitFullscreen } = useFullscreen(stageRef)

  const matchCountByMap = useMemo(() => {
    const c: Record<string, number> = {}
    const days = view.days
    for (const m of data.matches) if (!days || days.includes(m.day)) c[m.mapId] = (c[m.mapId] ?? 0) + 1
    return c
  }, [data, view.days])

  const dayMatches = useMemo(
    () => data.matches.filter((m) => m.mapId === view.map && (!view.days || view.days.includes(m.day))),
    [data, view.map, view.days],
  )
  const match = view.match ? (data.matchById.get(view.match) ?? null) : null
  const activeMatches = useMemo(() => (match ? [match] : dayMatches), [match, dayMatches])

  const journeys = useMemo(() => {
    const out: Journey[] = []
    for (const m of activeMatches)
      for (const j of m.journeys) if ((j.isBot ? view.bots : view.humans) && !hidden.has(j.key)) out.push(j)
    return out
  }, [activeMatches, view.humans, view.bots, hidden])

  const maxTime = useMemo(() => activeMatches.reduce((mx, m) => Math.max(mx, m.duration), 0), [activeMatches])

  // New selection: show the whole thing, stopped.
  useEffect(() => {
    setPlaying(false)
    setTime(maxTime)
    setHidden(new Set())
    setHighlight(null)
  }, [activeMatches, maxTime])

  // Playback clock
  const speedRef = useRef(speed)
  speedRef.current = speed
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setTime((t) => {
        const next = t + dt * speedRef.current
        if (next >= maxTime) {
          setPlaying(false)
          return maxTime
        }
        return next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, maxTime])

  // Keyboard: space = play/pause, esc = leave fullscreen, then back to all matches
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.code === 'Space') {
        e.preventDefault()
        setPlaying((p) => {
          if (!p && time >= maxTime) setTime(0)
          return !p
        })
      } else if (e.code === 'Escape') {
        if (isFullscreen) exitFullscreen()
        else setView({ match: null })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [time, maxTime, setView, isFullscreen, exitFullscreen])

  // Heatmap follows the same filters and the timeline.
  const heat = useMemo(() => {
    const layer = HEAT_LAYERS.find((h) => h.id === view.heat)!
    if (!layer.events.length) return { canvas: null, count: 0 }
    const types = new Set<EventType>(layer.events)
    const movement = layer.events.some((e) => MOVEMENT_EVENTS.has(e))
    const grid = new HeatGrid()
    for (const j of journeys) {
      const list = movement ? j.path : j.events
      for (const e of list) {
        if (e.t > time) break
        if (types.has(e.type)) grid.add(e.u, e.v)
      }
    }
    const canvas = document.createElement('canvas')
    const count = renderHeat(grid, canvas, !movement)
    return { canvas, count }
  }, [journeys, view.heat, time])

  const markerSet = useMemo(() => new Set(view.markers), [view.markers])

  const toggleJourney = useCallback((key: string) => {
    setHidden((h) => {
      const n = new Set(h)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }, [])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          LILA <span>BLACK</span>
        </div>
        <div className="crumbs">
          Player Journeys · <strong>{MAPS[view.map].label}</strong>
          {match && <span className="mono"> · {match.id.slice(0, 8)}</span>}
        </div>
        <div className="topbar-meta muted" title={data.stats.failed.slice(0, 20).join('\n') || undefined}>
          <strong>{data.label}</strong> · {data.stats.files.toLocaleString()} journeys · {data.matches.length} matches · {data.stats.duplicates.toLocaleString()} duplicate rows removed
          {data.stats.failed.length > 0 && ` · ${data.stats.failed.length} files skipped`}
        </div>
        <UploadButton onUpload={onUpload} />
        <button className="help-btn" onClick={() => setTourOpen(true)} title="Show the intro tour" aria-label="Show the intro tour">
          ?
        </button>
      </header>
      {tourOpen && <Tour steps={TOUR_STEPS} onClose={() => setTourOpen(false)} />}
      <Sidebar
        view={view}
        setView={setView}
        allDays={data.days}
        dayMatches={dayMatches}
        matchCountByMap={matchCountByMap}
        heatOpacity={heatOpacity}
        setHeatOpacity={setHeatOpacity}
        heatCount={heat.count}
      />
      <main className={isFullscreen ? 'stage fullscreen' : 'stage'} ref={stageRef}>
        <MapCanvas
          mapId={view.map}
          journeys={journeys}
          single={match !== null}
          time={time}
          showHeads={time < maxTime}
          showPaths={view.paths}
          markers={markerSet}
          heatCanvas={heat.canvas}
          heatOpacity={heatOpacity}
          highlightKey={highlight}
          onPickMatch={(id) => setView({ match: id })}
          fullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
        {journeys.length === 0 && <div className="empty">Nothing to show — try enabling humans/bots or selecting more dates.</div>}
        <Timeline
          time={time}
          max={maxTime}
          playing={playing}
          speed={speed}
          single={match !== null}
          journeys={journeys}
          markers={markerSet}
          onTime={setTime}
          onPlaying={setPlaying}
          onSpeed={setSpeed}
        />
      </main>
      <DetailsPanel
        match={match}
        matches={activeMatches}
        journeys={journeys}
        hidden={hidden}
        onToggleJourney={toggleJourney}
        onHighlight={setHighlight}
        onClose={() => setView({ match: null })}
      />
    </div>
  )
}
