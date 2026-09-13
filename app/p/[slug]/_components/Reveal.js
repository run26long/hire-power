'use client'

import { useEffect, useRef, useState } from 'react'

// ============================================================================
// One restrained lift as a block first enters the viewport, and never again.
//
// Two things this deliberately does not do. It does not run when the visitor
// has asked for reduced motion, and it does not start hidden unless it has
// already established that it can finish: with no IntersectionObserver, or with
// motion turned down, `shown` is true from the first paint rather than the
// content being stranded at zero opacity behind a feature that never arrives.
//
// `shown` is derived rather than stored for that reason. The only thing that
// writes state here is the observer, which is a subscription firing from
// outside React.
// ============================================================================
export default function Reveal({ children, enabled = true, delay = 0, className = '' }) {
  const canAnimate = enabled && typeof IntersectionObserver !== 'undefined'
  const [entered, setEntered] = useState(false)
  const ref = useRef(null)

  const shown = entered || !canAnimate

  useEffect(() => {
    if (!canAnimate) return
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        setEntered(true)
        observer.disconnect()
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 })

    observer.observe(node)
    return () => observer.disconnect()
  }, [canAnimate])

  return (
    <div
      ref={ref}
      className={className ? `hp-reveal ${className}` : 'hp-reveal'}
      data-revealed={shown ? 'true' : 'false'}
      style={delay && canAnimate ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
