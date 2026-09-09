import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Scroll-reveal driven by IntersectionObserver rather than a scroll listener,
 * so it costs nothing on the main thread while scrolling.
 *
 * Pair with the `.ba-reveal` CSS class: the initial hidden state lives in CSS
 * (avoiding a flash of unshifted content), and this hook only toggles `is-in`.
 *
 * ```tsx
 * const ref = useReveal<HTMLDivElement>()
 * <div ref={ref} className="ba-reveal">…</div>
 * ```
 */
export function useReveal<T extends HTMLElement>(options?: {
  /** Fraction of the element that must be visible. Default 0.15. */
  threshold?: number
  /** Re-hide when scrolled back out of view. Default false (reveal once). */
  repeat?: boolean
  /** Stagger delay in ms, written to the `--ba-reveal-delay` custom property. */
  delay?: number
}): RefObject<T | null> {
  const { threshold = 0.15, repeat = false, delay = 0 } = options ?? {}
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (delay) el.style.setProperty('--ba-reveal-delay', `${delay}ms`)

    // No observer support (or a very old browser): show the content rather
    // than leaving it permanently transparent.
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-in')
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-in')
          if (!repeat) observer.unobserve(el)
        } else if (repeat) {
          el.classList.remove('is-in')
        }
      },
      // Start the transition slightly before the element edge enters, so the
      // content has finished animating by the time it is properly on screen.
      { threshold, rootMargin: '0px 0px -8% 0px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, repeat, delay])

  return ref
}

/**
 * Writes the pointer position into `--mx` / `--my` on the element so the
 * `.ba-spotlight` radial highlight can follow the cursor.
 *
 * Updates are coalesced into a single rAF per frame: `pointermove` fires far
 * more often than the display refreshes, and each write would otherwise
 * invalidate style on its own.
 */
export function useSpotlight<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    let x = 0
    let y = 0

    const apply = () => {
      frame = 0
      el.style.setProperty('--mx', `${x}px`)
      el.style.setProperty('--my', `${y}px`)
    }

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      x = e.clientX - rect.left
      y = e.clientY - rect.top
      if (!frame) frame = requestAnimationFrame(apply)
    }

    el.addEventListener('pointermove', onMove)
    return () => {
      el.removeEventListener('pointermove', onMove)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return ref
}

/**
 * 3D tilt that follows the pointer. Returns the ref plus the inline transform,
 * letting the caller decide which element receives it.
 *
 * @param max Maximum rotation in degrees at the element edges.
 */
export function useTilt<T extends HTMLElement>(max = 8) {
  const ref = useRef<T>(null)
  const [transform, setTransform] = useState('')

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Tilt is a hover affordance; on touch there is no hover state and the
    // transform would stick after a tap.
    if (!window.matchMedia('(hover: hover)').matches) return

    let frame = 0

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      // Normalise to -0.5…0.5 around the element centre.
      const px = (e.clientX - rect.left) / rect.width - 0.5
      const py = (e.clientY - rect.top) / rect.height - 0.5
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setTransform(
          `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`
        )
      })
    }

    const onLeave = () => {
      if (frame) cancelAnimationFrame(frame)
      setTransform('')
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [max])

  return { ref, transform }
}

/**
 * Animates a number from 0 to `target` once it scrolls into view.
 *
 * Uses rAF with an ease-out curve rather than `setInterval`, so the count stays
 * in step with the display refresh and finishes in a fixed wall-clock time
 * regardless of frame rate.
 */
export function useCountUp(target: number, duration = 1600) {
  const ref = useRef<HTMLSpanElement>(null)
  const [value, setValue] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }

    let frame = 0
    let start = 0

    const step = (now: number) => {
      if (!start) start = now
      const progress = Math.min((now - start) / duration, 1)
      // easeOutExpo: fast start, long settle — reads as "counting up".
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setValue(Math.round(target * eased))
      if (progress < 1) frame = requestAnimationFrame(step)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.unobserve(el)
        frame = requestAnimationFrame(step)
      },
      { threshold: 0.4 }
    )

    observer.observe(el)
    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [target, duration])

  return { ref, value }
}

/** Vertical scroll progress of the document, 0 → 1. Throttled to one rAF. */
export function useScrollProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let frame = 0

    const update = () => {
      frame = 0
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      setProgress(scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0)
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return progress
}

/** True once the page has scrolled past `offset` px. For sticky-header states. */
export function useScrolled(offset = 24) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    let frame = 0

    const update = () => {
      frame = 0
      // A compact sticky header changes the document geometry. Without a dead
      // zone, that change can move scrollY back across the same threshold and
      // make the header expand/collapse repeatedly at one exact position.
      setScrolled((previous) => {
        const enterAt = offset
        const leaveAt = Math.max(0, offset - 16)
        return previous ? window.scrollY > leaveAt : window.scrollY > enterAt
      })
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [offset])

  return scrolled
}

/** Reads the OS reduced-motion preference and tracks changes to it. */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}
