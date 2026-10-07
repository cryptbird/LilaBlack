import { useMemo } from 'react'
import { MARKERS, type MarkerType } from '../config'
import type { Journey } from '../data/model'
import { fmtClock } from '../lib/format'

const SPEEDS = [1, 5, 10, 20, 40]
const TICK_TYPES: MarkerType[] = ['Kill', 'Killed', 'BotKill', 'BotKilled', 'KilledByStorm']

interface Props {
  time: number
  max: number
  playing: boolean
  speed: number
  single: boolean
  journeys: Journey[]
  markers: ReadonlySet<MarkerType>
  onTime: (t: number) => void
  onPlaying: (p: boolean) => void
  onSpeed: (s: number) => void
}

export function Timeline({ time, max, playing, speed, single, journeys, markers, onTime, onPlaying, onSpeed }: Props) {
  // Combat/death ticks along the track so you can jump straight to the action.
  const ticks = useMemo(() => {
    if (max <= 0) return []
    const out: { pct: number; color: string; key: string }[] = []
    for (const j of journeys)
      j.events.forEach((e, i) => {
        if (TICK_TYPES.includes(e.type as MarkerType) && markers.has(e.type as MarkerType)) out.push({ pct: (e.t / max) * 100, color: MARKERS[e.type as MarkerType].color, key: `${j.key}-${i}` })
      })
    return out.length > 600 ? [] : out
  }, [journeys, max, markers])

  const togglePlay = () => {
    if (!playing && time >= max) onTime(0)
    onPlaying(!playing)
  }

  return (
    <div className="timeline" data-tour="timeline">
      <button className="play-btn" onClick={togglePlay} disabled={max <= 0} title={playing ? 'Pause (space)' : 'Play (space)'}>
        {playing ? '❚❚' : '▶'}
      </button>
      <div className="tl-clock mono">
        {fmtClock(time)} <span className="muted">/ {fmtClock(max)}</span>
      </div>
      <div className="tl-track">
        <div className="tl-ticks">
          {ticks.map((t) => (
            <span key={t.key} className="tl-tick" style={{ left: `${t.pct}%`, background: t.color }} />
          ))}
        </div>
        <input type="range" min={0} max={Math.max(1, max)} step={0.5} value={Math.min(time, max)} onChange={(e) => onTime(Number(e.target.value))} aria-label="Match time" />
      </div>
      <select className="speed" data-tour="speed" value={speed} onChange={(e) => onSpeed(Number(e.target.value))} aria-label="Playback speed">
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s}×
          </option>
        ))}
      </select>
      <div className="tl-hint muted">{single ? 'Match replay' : 'All selected matches, aligned to match start'}</div>
    </div>
  )
}
