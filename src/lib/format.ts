export const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })

export const fmtDay = (iso: string) => dayFmt.format(new Date(`${iso}T00:00:00Z`))
export const fmtWallTime = (epochSec: number) => `${timeFmt.format(new Date(epochSec * 1000))} UTC`

export const shortId = (id: string) => (/^\d+$/.test(id) ? `#${id}` : id.slice(0, 8))

/** Index of the last element with t <= time (binary search), or -1. */
export function lastIndexAtOrBefore(list: { t: number }[], time: number) {
  let lo = 0
  let hi = list.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (list[mid].t <= time) {
      ans = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return ans
}
