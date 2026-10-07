import { MAPS, MARKER_TYPES, MARKERS, type MarkerType } from '../config'
import type { Journey, Match } from '../data/model'
import { fmtClock, fmtDay, fmtWallTime, shortId } from '../lib/format'
import { MarkerIcon } from './Sidebar'

interface Props {
  match: Match | null
  matches: Match[]
  journeys: Journey[]
  hidden: ReadonlySet<string>
  onToggleJourney: (key: string) => void
  onHighlight: (key: string | null) => void
  onClose: () => void
}

function countEvents(journeys: Journey[]) {
  const c = Object.fromEntries(MARKER_TYPES.map((m) => [m, 0])) as Record<MarkerType, number>
  for (const j of journeys) for (const e of j.events) c[e.type as MarkerType]++
  return c
}

export function DetailsPanel({ match, matches, journeys, hidden, onToggleJourney, onHighlight, onClose }: Props) {
  const counts = countEvents(journeys)
  const humans = journeys.filter((j) => !j.isBot)
  const bots = journeys.filter((j) => j.isBot)

  return (
    <aside className="details">
      {match ? (
        <>
          <div className="details-head">
            <div>
              <div className="eyebrow">Match</div>
              <div className="mono strong">{match.id.replace('.nakama-0', '')}</div>
            </div>
            <button className="link" onClick={onClose} title="Back to all matches">
              ✕
            </button>
          </div>
          <dl className="kv">
            <dt>Map</dt>
            <dd>{MAPS[match.mapId].label}</dd>
            <dt>Started</dt>
            <dd>
              {fmtDay(match.day)}, {fmtWallTime(match.start)}
            </dd>
            <dt>Length</dt>
            <dd>{fmtClock(match.duration)}</dd>
            <dt>Recorded</dt>
            <dd>
              {match.humans} human{match.humans === 1 ? '' : 's'}, {match.bots} bot{match.bots === 1 ? '' : 's'}
            </dd>
          </dl>
        </>
      ) : (
        <>
          <div className="details-head">
            <div>
              <div className="eyebrow">Overview</div>
              <div className="strong">{matches.length.toLocaleString()} matches</div>
            </div>
          </div>
          <dl className="kv">
            <dt>Unique humans</dt>
            <dd>{new Set(humans.map((j) => j.userId)).size}</dd>
            <dt>Human journeys</dt>
            <dd>{humans.length}</dd>
            <dt>Bot journeys</dt>
            <dd>{bots.length}</dd>
            <dt>Avg match length</dt>
            <dd>{matches.length ? fmtClock(matches.reduce((s, m) => s + m.duration, 0) / matches.length) : '–'}</dd>
          </dl>
        </>
      )}

      <h3>Events</h3>
      <div className="event-counts">
        {MARKER_TYPES.map((m) => (
          <div key={m} className="ec">
            <MarkerIcon type={m} />
            <span>{MARKERS[m].label}</span>
            <strong>{counts[m].toLocaleString()}</strong>
          </div>
        ))}
      </div>

      {match && (
        <>
          <h3>Players</h3>
          <div className="players">
            {match.journeys.map((j) => {
              const off = hidden.has(j.key)
              const kills = j.events.filter((e) => e.type === 'Kill' || e.type === 'BotKill').length
              const loot = j.events.filter((e) => e.type === 'Loot').length
              const death = j.events.find((e) => e.type === 'Killed' || e.type === 'BotKilled' || e.type === 'KilledByStorm')
              return (
                <button
                  key={j.key}
                  className={`player ${off ? 'off' : ''}`}
                  onClick={() => onToggleJourney(j.key)}
                  onMouseEnter={() => !off && onHighlight(j.key)}
                  onMouseLeave={() => onHighlight(null)}
                  title={off ? 'Show this player' : 'Hide this player'}
                >
                  <span className={`swatch ${j.isBot ? 'bot' : ''}`} style={{ background: j.color }} />
                  <span className={j.isBot ? 'tag bot' : 'tag human'}>{j.isBot ? 'Bot' : 'Human'}</span>
                  <span className="mono">{shortId(j.userId)}</span>
                  <span className="p-stats muted">
                    {kills > 0 && `⚔${kills} `}
                    {loot > 0 && `◆${loot} `}
                    {death && <span style={{ color: MARKERS[death.type as MarkerType].color }}>✝{fmtClock(death.t)}</span>}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="hint muted">Hover a player to highlight, click to hide/show.</p>
        </>
      )}
    </aside>
  )
}
