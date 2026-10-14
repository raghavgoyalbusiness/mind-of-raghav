/**
 * A tiny synthesised sound layer (no audio files): an ambient pad that opens
 * up as you enter the hall, and bell chimes pitched by emotion.
 */
const PAD_NOTES = [146.83, 220.0, 329.63, 369.99, 554.37] // D3 A3 E4 F#4 C#5: Dmaj9
const STORE_KEY = 'mind:sound'

class SoundEngine {
  ctx: AudioContext | null = null
  private master!: GainNode
  private wet!: GainNode
  private padFilter!: BiquadFilterNode
  private padGain!: GainNode
  enabled = false
  private listeners = new Set<(on: boolean) => void>()

  get wanted() {
    try {
      return localStorage.getItem(STORE_KEY) === '1'
    } catch {
      return false
    }
  }

  onChange(fn: (on: boolean) => void) {
    this.listeners.add(fn)
    return () => void this.listeners.delete(fn)
  }

  private build() {
    const ctx = new AudioContext()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(ctx.destination)

    // generated reverb: decaying stereo noise
    const len = ctx.sampleRate * 3.8
    const ir = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2)
    }
    const verb = ctx.createConvolver()
    verb.buffer = ir
    this.wet = ctx.createGain()
    this.wet.gain.value = 0.55
    this.wet.connect(verb).connect(this.master)

    // the pad: detuned saw pairs through a slowly breathing low-pass
    this.padFilter = ctx.createBiquadFilter()
    this.padFilter.type = 'lowpass'
    this.padFilter.frequency.value = 420
    this.padFilter.Q.value = 0.6
    this.padGain = ctx.createGain()
    this.padGain.gain.value = 0.5
    this.padFilter.connect(this.padGain)
    this.padGain.connect(this.master)
    this.padGain.connect(this.wet)

    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.045
    const lfoAmt = ctx.createGain()
    lfoAmt.gain.value = 140
    lfo.connect(lfoAmt).connect(this.padFilter.frequency)
    lfo.start()

    PAD_NOTES.forEach((f, i) => {
      const voice = ctx.createGain()
      voice.gain.value = 0.045 / (1 + i * 0.25)
      for (const cents of [-7, 6]) {
        const o = ctx.createOscillator()
        o.type = i === 0 ? 'triangle' : 'sawtooth'
        o.frequency.value = f
        o.detune.value = cents
        o.connect(voice)
        o.start()
      }
      // each voice swells on its own slow tide
      const tide = ctx.createOscillator()
      tide.frequency.value = 0.06 + i * 0.017
      const tideAmt = ctx.createGain()
      tideAmt.gain.value = voice.gain.value * 0.6
      tide.connect(tideAmt).connect(voice.gain)
      tide.start()
      voice.connect(this.padFilter)
    })
  }

  async enable() {
    if (!this.ctx) this.build()
    await this.ctx!.resume()
    const t = this.ctx!.currentTime
    this.master.gain.cancelScheduledValues(t)
    this.master.gain.setTargetAtTime(0.8, t, 0.8)
    this.set(true)
  }

  disable() {
    if (this.ctx) {
      const t = this.ctx.currentTime
      this.master.gain.cancelScheduledValues(t)
      this.master.gain.setTargetAtTime(0, t, 0.25)
    }
    this.set(false)
  }

  toggle() {
    return this.enabled ? this.disable() : this.enable()
  }

  private set(on: boolean) {
    this.enabled = on
    try {
      localStorage.setItem(STORE_KEY, on ? '1' : '0')
    } catch {
      /* private mode */
    }
    this.listeners.forEach((f) => f(on))
  }

  /** Called every frame: the pad brightens as the hall opens up around you. */
  update(hall: number, focus: boolean) {
    if (!this.enabled || !this.ctx) return
    const target = 380 + hall * 1500 + (focus ? 600 : 0)
    this.padFilter.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.6)
  }

  /** A soft bell: fundamental + inharmonic partial + low body, into the reverb. */
  chime(freq: number, vel = 1) {
    if (!this.enabled || !this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const out = ctx.createGain()
    out.gain.setValueAtTime(0, t)
    out.gain.linearRampToValueAtTime(0.16 * vel, t + 0.008)
    out.gain.exponentialRampToValueAtTime(0.0001, t + 2.4)
    out.connect(this.master)
    out.connect(this.wet)
    for (const [mult, amp, type] of [
      [1, 1, 'sine'],
      [2.76, 0.28, 'sine'],
      [5.4, 0.08, 'sine'],
      [0.5, 0.22, 'triangle'],
    ] as const) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = type
      o.frequency.value = freq * mult
      g.gain.value = amp
      o.connect(g).connect(out)
      o.start(t)
      o.stop(t + 2.5)
    }
  }

  /** A rising three-note figure (memory opened). */
  arpeggio(freq: number) {
    ;[1, 1.25, 1.5].forEach((m, i) => setTimeout(() => this.chime(freq * m, 0.7), i * 110))
  }

  /** Filtered noise swell (reversing the spin, pulling FOCUS). */
  swell(up = true) {
    if (!this.enabled || !this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const buf = ctx.createBuffer(1, ctx.sampleRate * 1.6, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 6
    bp.frequency.setValueAtTime(up ? 300 : 2400, t)
    bp.frequency.exponentialRampToValueAtTime(up ? 2400 : 300, t + 1.4)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.12, t + 0.5)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.55)
    src.connect(bp).connect(g)
    g.connect(this.master)
    g.connect(this.wet)
    src.start(t)
  }
}

export const sound = new SoundEngine()
