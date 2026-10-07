import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface TourStep {
  /** `data-tour` value of the element to highlight; omit for a centred intro card. */
  target?: string
  title: string
  body: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to Player Journeys',
    body: 'This tool replays real LILA BLACK matches on top of the minimap, so you can see where players walk, fight, loot and die. Scroll to zoom the map, drag to pan, and hover any marker for details. Here’s a 30-second tour.',
  },
  {
    target: 'map',
    title: 'Pick a map',
    body: 'Switch between Ambrose Valley, Grand Rift and Lockdown. The small number is how many matches were played on each map for the selected dates.',
  },
  {
    target: 'date',
    title: 'Choose dates',
    body: 'Toggle days on or off to compare them. “all” resets the selection. Days marked * are partial (data was still being collected).',
  },
  {
    target: 'show',
    title: 'Humans, bots and paths',
    body: 'Humans are solid cyan lines, bots are dashed orange lines. Hide either group to focus on one, or turn paths off entirely to read heatmaps more clearly.',
  },
  {
    target: 'events',
    title: 'Event markers',
    body: 'Crosses are kills, dots are deaths, diamonds are loot pickups. Red means vs a human, orange vs a bot, purple is the storm. Click a row to show or hide that event type.',
  },
  {
    target: 'heatmap',
    title: 'Heatmaps',
    body: 'Traffic shows where people spend time. Kills, Deaths and Storm deaths show where those happen. Loot shows where items get picked up. Red is hottest. Heatmaps follow your filters and the timeline.',
  },
  {
    target: 'matches',
    title: 'Matches',
    body: 'Every match for the current map and dates. Pick one to replay it on its own, or stay on “All matches” to see everything layered together. Sort by players, combat or length, or search by ID.',
  },
  {
    target: 'timeline',
    title: 'Timeline & playback',
    body: 'Press play (or the space bar) to watch the match unfold. Drag the slider to jump around; the coloured ticks above it mark kills and deaths.',
  },
  {
    target: 'speed',
    title: 'Playback speed',
    body: 'Matches last around 6–15 minutes. 10× replays a full match in about a minute; use 1× to study a fight closely.',
  },
  {
    target: 'upload',
    title: 'Bring your own data',
    body: 'Upload a new player_data .zip (same layout as the original export) to explore other days. You can also drag a zip onto the page. You can replay this tour any time from the “?” button.',
  },
]

const STORAGE_KEY = 'lila.tourDone.v1'

export function shouldAutoStartTour() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '1'
  } catch {
    return true
  }
}

function markTourDone() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* storage unavailable: the tour will just show again next time */
  }
}

const PAD = 6
const CARD_W = 320
const GAP = 14

export function Tour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardH, setCardH] = useState(180)
  const step = steps[idx]
  const last = idx === steps.length - 1

  const finish = useCallback(() => {
    markTourDone()
    onClose()
  }, [onClose])

  // Track the highlighted element's position (it can move on resize/scroll).
  useLayoutEffect(() => {
    if (!step.target) {
      setRect(null)
      return
    }
    const el = document.querySelector(`[data-tour="${step.target}"]`)
    if (!el) {
      setRect(null)
      return
    }
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    let raf = 0
    const measure = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setRect(el.getBoundingClientRect()))
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step.target])

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight)
  }, [idx, rect])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') last ? finish() : setIdx((i) => i + 1)
      else if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1))
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [finish, last])

  const card = placeCard(rect, cardH)

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect ? (
        <div
          className="tour-spot"
          style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
        />
      ) : (
        <div className="tour-dim" />
      )}
      <div ref={cardRef} className="tour-card" style={{ left: card.left, top: card.top, width: CARD_W }}>
        <div className="tour-step muted">
          {idx + 1} of {steps.length}
        </div>
        <h4 id="tour-title">{step.title}</h4>
        <p>{step.body}</p>
        <div className="tour-dots">
          {steps.map((_, i) => (
            <span key={i} className={i === idx ? 'on' : ''} />
          ))}
        </div>
        <div className="tour-actions">
          <button className="tour-skip" onClick={finish}>
            {last ? 'Close' : 'Skip tour'}
          </button>
          <div className="tour-nav">
            {idx > 0 && (
              <button className="tour-back" onClick={() => setIdx(idx - 1)}>
                Back
              </button>
            )}
            <button className="tour-next" onClick={() => (last ? finish() : setIdx(idx + 1))} autoFocus>
              {last ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Put the card beside the target (right, left, below, above — whichever fits), clamped to the viewport. */
function placeCard(rect: DOMRect | null, cardH: number) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const clampX = (x: number) => Math.max(12, Math.min(vw - CARD_W - 12, x))
  const clampY = (y: number) => Math.max(12, Math.min(vh - cardH - 12, y))
  if (!rect) return { left: clampX((vw - CARD_W) / 2), top: clampY((vh - cardH) / 2) }
  if (rect.right + GAP + CARD_W < vw) return { left: rect.right + GAP, top: clampY(rect.top) }
  if (rect.left - GAP - CARD_W > 0) return { left: rect.left - GAP - CARD_W, top: clampY(rect.top) }
  if (rect.bottom + GAP + cardH < vh) return { left: clampX(rect.left), top: rect.bottom + GAP }
  return { left: clampX(rect.left), top: clampY(rect.top - GAP - cardH) }
}
