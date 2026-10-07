import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BOT_COLOR, HUMAN_COLOR, MAPS, MARKERS, type MapId, type MarkerType } from '../config'
import type { GameEvent, Journey } from '../data/model'
import { fmtClock, fmtDay, lastIndexAtOrBefore, shortId } from '../lib/format'

/** Minimap is drawn as a BASE×BASE square in "map units"; the view transform scales/offsets it. */
const BASE = 1024
const MIN_ZOOM = 0.5
const MAX_ZOOM = 12
// Draw order: loot underneath, deaths on top.
const MARKER_ORDER: MarkerType[] = ['Loot', 'BotKill', 'Kill', 'BotKilled', 'Killed', 'KilledByStorm']

interface Props {
  mapId: MapId
  journeys: Journey[]
  single: boolean
  time: number
  showHeads: boolean
  showPaths: boolean
  markers: ReadonlySet<MarkerType>
  heatCanvas: HTMLCanvasElement | null
  heatOpacity: number
  highlightKey: string | null
  onPickMatch: (matchId: string) => void
  fullscreen: boolean
  onToggleFullscreen: () => void
}

interface Hit {
  x: number
  y: number
  ev: GameEvent
  journey: Journey
}

interface View {
  k: number
  ox: number
  oy: number
}

export function MapCanvas(props: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<View>({ k: 1, ox: 0, oy: 0 })
  /** Until the user pans/zooms, keep the map fitted to the container on resize. */
  const userMovedRef = useRef(false)
  const sizeRef = useRef({ w: 0, h: 0 })
  const imgRef = useRef<HTMLImageElement | null>(null)
  const hitsRef = useRef<Hit[]>([])
  const propsRef = useRef(props)
  propsRef.current = props
  const frameRef = useRef(0)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [hover, setHover] = useState<{ hit: Hit; x: number; y: number } | null>(null)
  const [cursorWorld, setCursorWorld] = useState<{ x: number; z: number } | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const p = propsRef.current
    const { w, h } = sizeRef.current
    const dpr = window.devicePixelRatio || 1
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#07090d'
    ctx.fillRect(0, 0, w, h)

    const { k, ox, oy } = viewRef.current
    const size = BASE * k
    const sx = (u: number) => ox + u * size
    const sy = (v: number) => oy + (1 - v) * size

    const img = imgRef.current
    if (img?.complete && img.naturalWidth) {
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, ox, oy, size, size)
      ctx.fillStyle = 'rgba(5,8,12,0.28)' // slight dim so overlays read clearly
      ctx.fillRect(ox, oy, size, size)
    }

    if (p.heatCanvas && p.heatOpacity > 0) {
      ctx.globalAlpha = p.heatOpacity
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(p.heatCanvas, ox, oy, size, size)
      ctx.globalAlpha = 1
    }

    const highlighted = p.highlightKey
    const dimOthers = (j: Journey) => highlighted !== null && j.key !== highlighted

    // Paths
    if (p.showPaths) {
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      const tracePath = (j: Journey) => {
        const idx = lastIndexAtOrBefore(j.path, p.time)
        if (idx < 0) return
        ctx.moveTo(sx(j.path[0].u), sy(j.path[0].v))
        for (let i = 1; i <= idx; i++) ctx.lineTo(sx(j.path[i].u), sy(j.path[i].v))
        const head = interpolate(j.path, idx, p.time)
        if (head) ctx.lineTo(sx(head.u), sy(head.v))
      }
      if (p.single) {
        for (const j of p.journeys) {
          ctx.beginPath()
          tracePath(j)
          ctx.globalAlpha = dimOthers(j) ? 0.2 : 0.95
          ctx.strokeStyle = j.color
          ctx.lineWidth = j.key === highlighted ? 3.5 : 2.2
          ctx.setLineDash(j.isBot ? [5, 4] : [])
          ctx.stroke()
        }
      } else {
        // Aggregate view: batch all paths per actor type into one stroke each.
        for (const bot of [true, false]) {
          ctx.beginPath()
          for (const j of p.journeys) if (j.isBot === bot) tracePath(j)
          ctx.globalAlpha = bot ? 0.45 : 0.32
          ctx.strokeStyle = bot ? BOT_COLOR : HUMAN_COLOR
          ctx.lineWidth = bot ? 1 : 1.1
          ctx.setLineDash(bot ? [4, 3] : [])
          ctx.stroke()
        }
      }
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }

    // Current positions during playback
    if (p.showHeads) {
      for (const j of p.journeys) {
        const idx = lastIndexAtOrBefore(j.path, p.time)
        if (idx < 0 || p.time > j.path[j.path.length - 1].t) continue
        const head = interpolate(j.path, idx, p.time) ?? j.path[idx]
        const r = p.single ? 5 : 3
        ctx.beginPath()
        if (j.isBot) ctx.rect(sx(head.u) - r, sy(head.v) - r, r * 2, r * 2)
        else ctx.arc(sx(head.u), sy(head.v), r, 0, Math.PI * 2)
        ctx.fillStyle = p.single ? j.color : j.isBot ? BOT_COLOR : HUMAN_COLOR
        ctx.globalAlpha = dimOthers(j) ? 0.25 : 1
        ctx.fill()
        ctx.lineWidth = 1.5
        ctx.strokeStyle = '#05070a'
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    // Event markers
    const hits: Hit[] = []
    const scale = p.single ? 1 : 0.75
    for (const type of MARKER_ORDER) {
      if (!p.markers.has(type)) continue
      const style = MARKERS[type]
      for (const j of p.journeys) {
        for (const ev of j.events) {
          if (ev.type !== type) continue
          if (ev.t > p.time) break
          const x = sx(ev.u)
          const y = sy(ev.v)
          if (x < -10 || y < -10 || x > w + 10 || y > h + 10) continue
          ctx.globalAlpha = dimOthers(j) ? 0.2 : 1
          drawMarker(ctx, style.shape, style.color, x, y, scale)
          hits.push({ x, y, ev, journey: j })
        }
      }
    }
    ctx.globalAlpha = 1
    hitsRef.current = hits
  }, [])

  const scheduleDraw = useCallback(() => {
    cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(draw)
  }, [draw])

  const fit = useCallback(() => {
    const { w, h } = sizeRef.current
    const k = (Math.min(w, h) * 0.96) / BASE
    viewRef.current = { k, ox: (w - BASE * k) / 2, oy: (h - BASE * k) / 2 }
    userMovedRef.current = false
    scheduleDraw()
  }, [scheduleDraw])

  // Canvas sizing
  useLayoutEffect(() => {
    const wrap = wrapRef.current!
    const canvas = canvasRef.current!
    const ro = new ResizeObserver(() => {
      const { width, height } = wrap.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      const prev = sizeRef.current
      sizeRef.current = { w: width, h: height }
      if (!userMovedRef.current) fit()
      else {
        // Keep whatever was in the middle in the middle (e.g. entering fullscreen while zoomed in).
        const v = viewRef.current
        viewRef.current = { ...v, ox: v.ox + (width - prev.w) / 2, oy: v.oy + (height - prev.h) / 2 }
        draw()
      }
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [draw, fit])

  // Minimap image
  useEffect(() => {
    setImgLoaded(false)
    const img = new Image()
    img.src = `${import.meta.env.BASE_URL}${MAPS[props.mapId].image}`
    img.onload = () => {
      setImgLoaded(true)
      scheduleDraw()
    }
    imgRef.current = img
    fit()
  }, [props.mapId, fit, scheduleDraw])

  // Redraw whenever anything visual changes
  useEffect(scheduleDraw, [
    scheduleDraw,
    props.journeys,
    props.single,
    props.time,
    props.showHeads,
    props.showPaths,
    props.markers,
    props.heatCanvas,
    props.heatOpacity,
    props.highlightKey,
  ])

  // Wheel zoom around the cursor (non-passive so we can prevent page scroll)
  useEffect(() => {
    const canvas = canvasRef.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0015))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  })

  const zoomAt = (x: number, y: number, factor: number) => {
    const v = viewRef.current
    const fitK = (Math.min(sizeRef.current.w, sizeRef.current.h) * 0.96) / BASE
    const k = Math.min(fitK * MAX_ZOOM, Math.max(fitK * MIN_ZOOM, v.k * factor))
    const f = k / v.k
    viewRef.current = { k, ox: x - (x - v.ox) * f, oy: y - (y - v.oy) * f }
    userMovedRef.current = true
    scheduleDraw()
  }

  // Drag to pan; a click without movement picks a marker
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const d = dragRef.current
    if (d) {
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      if (d.moved || Math.abs(dx) + Math.abs(dy) > 3) {
        d.moved = true
        userMovedRef.current = true
        viewRef.current = { ...viewRef.current, ox: viewRef.current.ox + dx, oy: viewRef.current.oy + dy }
        d.x = e.clientX
        d.y = e.clientY
        setHover(null)
        scheduleDraw()
        return
      }
    }
    // Hover: nearest marker within 9px
    let best: Hit | null = null
    let bestD = 81
    for (const hit of hitsRef.current) {
      const dd = (hit.x - mx) ** 2 + (hit.y - my) ** 2
      if (dd <= bestD) {
        bestD = dd
        best = hit
      }
    }
    setHover(best ? { hit: best, x: mx, y: my } : null)
    // World coordinate readout under cursor
    const { k, ox, oy } = viewRef.current
    const u = (mx - ox) / (BASE * k)
    const v = 1 - (my - oy) / (BASE * k)
    const m = MAPS[props.mapId]
    setCursorWorld(u >= 0 && u <= 1 && v >= 0 && v <= 1 ? { x: u * m.scale + m.originX, z: v * m.scale + m.originZ } : null)
  }
  const onPointerUp = () => {
    const d = dragRef.current
    dragRef.current = null
    if (d && !d.moved && hover && !props.single) props.onPickMatch(hover.hit.journey.matchId)
  }

  const zoomCenter = (factor: number) => zoomAt(sizeRef.current.w / 2, sizeRef.current.h / 2, factor)

  return (
    <div className="map-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className={hover && !props.single ? 'clickable' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          setHover(null)
          setCursorWorld(null)
        }}
        onDoubleClick={fit}
      />
      {!imgLoaded && <div className="map-loading">Loading minimap…</div>}
      <div className="zoom-controls">
        <button onClick={() => zoomCenter(1.4)} title="Zoom in">+</button>
        <button onClick={() => zoomCenter(1 / 1.4)} title="Zoom out">−</button>
        <button onClick={fit} title="Reset view (or double-click map)" aria-label="Reset view">
          <Icon d={ICON_RESET} />
        </button>
        <button
          onClick={props.onToggleFullscreen}
          title={props.fullscreen ? 'Exit fullscreen (esc)' : 'Fullscreen'}
          aria-label={props.fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          aria-pressed={props.fullscreen}
        >
          <Icon d={props.fullscreen ? ICON_COLLAPSE : ICON_EXPAND} />
        </button>
      </div>
      {cursorWorld && (
        <div className="coord-readout">
          x {cursorWorld.x.toFixed(0)} · z {cursorWorld.z.toFixed(0)}
        </div>
      )}
      {hover && <Tooltip hit={hover.hit} x={hover.x} y={hover.y} single={props.single} />}
    </div>
  )
}

const ICON_RESET = 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5'
const ICON_EXPAND = 'M8 3H5a2 2 0 0 0-2 2v3 M21 8V5a2 2 0 0 0-2-2h-3 M3 16v3a2 2 0 0 0 2 2h3 M16 21h3a2 2 0 0 0 2-2v-3'
const ICON_COLLAPSE = 'M8 3v3a2 2 0 0 1-2 2H3 M21 8h-3a2 2 0 0 1-2-2V3 M3 16h3a2 2 0 0 1 2 2v3 M16 21v-3a2 2 0 0 1 2-2h3'

function Icon({ d }: { d: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

function Tooltip({ hit, x, y, single }: { hit: Hit; x: number; y: number; single: boolean }) {
  const style = MARKERS[hit.ev.type as MarkerType]
  const j = hit.journey
  return (
    <div className="tooltip" style={{ left: x + 14, top: y + 14 }}>
      <div className="tt-title">
        <span className="tt-swatch" style={{ background: style.color }} />
        {style.label}
      </div>
      <div className="tt-row">{style.description}</div>
      <div className="tt-row">
        <span className={j.isBot ? 'tag bot' : 'tag human'}>{j.isBot ? 'Bot' : 'Human'}</span> {shortId(j.userId)}
      </div>
      <div className="tt-row muted">
        at {fmtClock(hit.ev.t)} into match · elev {hit.ev.y.toFixed(0)}
      </div>
      {!single && (
        <div className="tt-row muted">
          {fmtDay(j.day)} · match {j.matchId.slice(0, 8)} — click to open
        </div>
      )}
    </div>
  )
}

/** Position between sample idx and idx+1 at `time` (linear), or null at the end of the path. */
function interpolate(path: GameEvent[], idx: number, time: number) {
  const a = path[idx]
  const b = path[idx + 1]
  if (!b || b.t === a.t) return null
  const f = Math.min(1, Math.max(0, (time - a.t) / (b.t - a.t)))
  return { u: a.u + (b.u - a.u) * f, v: a.v + (b.v - a.v) * f }
}

function drawMarker(ctx: CanvasRenderingContext2D, shape: 'cross' | 'dot' | 'diamond', color: string, x: number, y: number, scale: number) {
  ctx.beginPath()
  if (shape === 'cross') {
    const r = 5 * scale
    ctx.moveTo(x - r, y - r)
    ctx.lineTo(x + r, y + r)
    ctx.moveTo(x + r, y - r)
    ctx.lineTo(x - r, y + r)
    ctx.lineCap = 'round'
    ctx.lineWidth = 4.5 * scale
    ctx.strokeStyle = '#05070a'
    ctx.stroke()
    ctx.lineWidth = 2.4 * scale
    ctx.strokeStyle = color
    ctx.stroke()
  } else if (shape === 'dot') {
    ctx.arc(x, y, 5 * scale, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.lineWidth = 1.6
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()
  } else {
    const r = 3.6 * scale
    ctx.moveTo(x, y - r)
    ctx.lineTo(x + r, y)
    ctx.lineTo(x, y + r)
    ctx.lineTo(x - r, y)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    ctx.lineWidth = 1
    ctx.strokeStyle = '#05070a'
    ctx.stroke()
  }
}
