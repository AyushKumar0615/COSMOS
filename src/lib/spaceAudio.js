/**
 * Quiet, generated cabin audio for the open universe: a low suit-fan hum,
 * thruster hiss that follows thrust, and a soft chime for discoveries.
 * Nothing is downloaded, and nothing plays until the visitor turns sound on.
 */
export function createSpaceAudio(volume = 0.6) {
  const Context = window.AudioContext ?? window.webkitAudioContext
  if (!Context) return null
  const ctx = new Context()
  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)
  master.gain.setTargetAtTime(volume * 0.8, ctx.currentTime, 0.6)

  // Brown noise, two seconds, looped.
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i += 1) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
    data[i] = last * 3.2
  }
  const noise = (gain, type, frequency, q = 0.7) => {
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = frequency
    filter.Q.value = q
    const g = ctx.createGain()
    g.gain.value = gain
    source.connect(filter).connect(g).connect(master)
    source.start()
    return { source, filter, gain: g }
  }
  noise(0.22, 'lowpass', 180) // the suit fan's hum
  const thruster = noise(0, 'bandpass', 420, 0.9)
  const drone = ctx.createOscillator()
  drone.frequency.value = 55
  const droneGain = ctx.createGain()
  droneGain.gain.value = 0.03
  drone.connect(droneGain).connect(master)
  drone.start()

  return {
    update(thrust, speedLog) {
      const now = ctx.currentTime
      thruster.gain.gain.setTargetAtTime(Math.min(1, thrust) * 0.32, now, 0.15)
      thruster.filter.frequency.setTargetAtTime(300 + speedLog * 40 + thrust * 260, now, 0.3)
      drone.frequency.setTargetAtTime(48 + speedLog * 1.6, now, 0.8)
    },
    setVolume(value) {
      master.gain.setTargetAtTime(value * 0.8, ctx.currentTime, 0.1)
    },
    /** Short interface tones: a target locked, autopilot engaged, arrival, cancel. */
    blip(kind) {
      const now = ctx.currentTime
      const notes = { lock: [880], engage: [523, 784], arrive: [784, 523, 659], cancel: [392] }[kind] ?? [660]
      notes.forEach((f, i) => {
        const o = ctx.createOscillator()
        o.type = 'sine'
        o.frequency.value = f
        const g = ctx.createGain()
        const t = now + i * 0.09
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.045, t + 0.01)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
        o.connect(g).connect(master)
        o.start(t)
        o.stop(t + 0.3)
      })
    },
    chime() {
      const now = ctx.currentTime
      for (const [i, f] of [660, 990].entries()) {
        const o = ctx.createOscillator()
        o.frequency.value = f
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, now + i * 0.12)
        g.gain.linearRampToValueAtTime(0.06, now + i * 0.12 + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.9)
        o.connect(g).connect(master)
        o.start(now + i * 0.12)
        o.stop(now + i * 0.12 + 1)
      }
    },
    close() {
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.1)
      window.setTimeout(() => ctx.close().catch(() => {}), 400)
    },
  }
}
