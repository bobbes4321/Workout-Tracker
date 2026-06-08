import confetti from 'canvas-confetti'

const ACCENT = ['#c2f53c', '#8fb528', '#f4f4f6']

/** Short haptic buzz where supported (no-op on iOS / desktop). */
export function buzz(pattern: number | number[] = 12) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* unsupported — ignore */
  }
}

/** A modest confetti pop + buzz for a new personal record. */
export function celebratePR() {
  buzz([8, 30, 16])
  confetti({
    particleCount: 70,
    spread: 68,
    startVelocity: 36,
    origin: { y: 0.72 },
    colors: ACCENT,
    scalar: 0.9,
    disableForReducedMotion: true,
  })
}

/** A bigger, two-sided burst for reaching a goal. */
export function celebrateGoal() {
  buzz([10, 40, 24, 40])
  const burst = (x: number) =>
    confetti({
      particleCount: 90,
      spread: 80,
      startVelocity: 46,
      origin: { x, y: 0.7 },
      colors: ACCENT,
      disableForReducedMotion: true,
    })
  burst(0.28)
  burst(0.72)
}
