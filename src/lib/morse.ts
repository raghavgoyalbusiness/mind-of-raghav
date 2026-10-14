const CODE: Record<string, string> = { W: '.--', E: '.', O: '---', N: '-.', G: '--.' }
export const TAGLINE = 'WE ON GO'
export const UNIT = 0.2 // seconds per Morse unit

/** Timeline of [closed?, duration, letterIndex] steps for blinking a phrase in Morse. */
export function morseTimeline(text = TAGLINE) {
  const steps: { closed: boolean; d: number; letter: number }[] = []
  ;[...text].forEach((ch, li) => {
    if (ch === ' ') return void steps.push({ closed: false, d: UNIT * 4, letter: li }) // 7 units total with the letter gap
    const code = CODE[ch] ?? ''
    ;[...code].forEach((sym, si) => {
      steps.push({ closed: true, d: (sym === '.' ? 1 : 3) * UNIT, letter: li })
      if (si < code.length - 1) steps.push({ closed: false, d: UNIT, letter: li })
    })
    steps.push({ closed: false, d: UNIT * 3, letter: li })
  })
  return steps
}

export const morseOf = (ch: string) => (CODE[ch] ?? '').replace(/\./g, '·').replace(/-/g, '–')
