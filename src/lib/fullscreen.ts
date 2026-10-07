import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

// Safari < 16.4 only ships the prefixed API.
type FsDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }

const doc = () => document as FsDocument
const fullscreenElement = () => doc().fullscreenElement ?? doc().webkitFullscreenElement ?? null

/**
 * Make an element fill the screen. The caller styles it as a fixed full-viewport overlay while
 * `isFullscreen` is true, which works everywhere (including iPhone Safari, which has no element
 * Fullscreen API); where the browser allows it we also go native fullscreen to hide its chrome.
 */
export function useFullscreen(ref: RefObject<HTMLElement>) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const nativeRef = useRef(false)

  useEffect(() => {
    // Leaving native fullscreen via the browser (Esc, back gesture, F11) leaves the overlay too.
    const onChange = () => {
      if (fullscreenElement() === ref.current) {
        nativeRef.current = true
        setIsFullscreen(true)
      } else if (nativeRef.current) {
        nativeRef.current = false
        setIsFullscreen(false)
      }
    }
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [ref])

  const enter = useCallback(() => {
    setIsFullscreen(true)
    const el = ref.current as FsElement | null
    const request = el && (el.requestFullscreen ?? el.webkitRequestFullscreen)
    // Best effort: may be missing, denied, or never settle — the overlay already covers the screen.
    if (request) Promise.resolve(request.call(el)).catch(() => {})
  }, [ref])

  const exit = useCallback(() => {
    setIsFullscreen(false)
    nativeRef.current = false
    if (fullscreenElement()) {
      const d = doc()
      Promise.resolve((d.exitFullscreen ?? d.webkitExitFullscreen)?.call(d)).catch(() => {})
    }
  }, [])

  const toggle = useCallback(() => (isFullscreen ? exit() : enter()), [isFullscreen, enter, exit])

  return { isFullscreen, toggle, exit }
}
