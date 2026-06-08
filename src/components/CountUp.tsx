import { useEffect } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'motion/react'

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** A number that eases up to its value on mount / change. */
export function CountUp({
  value,
  decimals = 0,
  className,
}: {
  value: number
  decimals?: number
  className?: string
}) {
  const mv = useMotionValue(value)
  const text = useTransform(mv, (v) => {
    const f = 10 ** decimals
    return (Math.round(v * f) / f).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  })

  useEffect(() => {
    if (reduced()) {
      mv.set(value)
      return
    }
    const controls = animate(mv, value, {
      duration: 0.85,
      ease: [0.16, 1, 0.3, 1],
    })
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return <motion.span className={className}>{text}</motion.span>
}
