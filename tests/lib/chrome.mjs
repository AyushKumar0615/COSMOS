import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * A small DevTools Protocol client: the installed Chrome driven over Node's
 * built-in WebSocket, so the browser tests add no dependencies to the project.
 */
export async function launchChrome() {
  const binary = CANDIDATES.find((candidate) => fs.existsSync(candidate))
  if (!binary) throw new Error('Chrome not found. Set CHROME_PATH to its executable.')

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cosmos-chrome-'))
  const child = spawn(binary, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--enable-unsafe-swiftshader',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] })

  const wsUrl = await new Promise((resolve, reject) => {
    let log = ''
    child.stderr.on('data', (chunk) => {
      log += chunk
      const match = log.match(/DevTools listening on (ws:\S+)/)
      if (match) resolve(match[1])
    })
    child.on('exit', () => reject(new Error(`Chrome exited early:\n${log}`)))
  })

  const socket = new WebSocket(wsUrl)
  await new Promise((resolve) => socket.addEventListener('open', resolve))

  let nextId = 0
  const pending = new Map()
  const listeners = new Map()
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.id != null) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result)
    } else {
      listeners.get(message.sessionId)?.(message.method, message.params)
    }
  })

  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = (nextId += 1)
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params, sessionId }))
    })

  return {
    newPage: (options) => createPage(send, listeners, options),
    async close() {
      child.removeAllListeners('exit')
      const exited = new Promise((resolve) => child.once('exit', resolve))
      child.kill()
      socket.close()
      await exited
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    },
  }
}

async function createPage(send, listeners, { width, height, mobile = false, reducedMotion = false, noWebgl = false, blockFonts = false }) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const cmd = (method, params) => send(method, params, sessionId)

  const problems = []
  listeners.set(sessionId, (method, params) => {
    if (method === 'Runtime.exceptionThrown') {
      problems.push(`exception: ${params.exceptionDetails.exception?.description ?? params.exceptionDetails.text}`)
    } else if (method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(params.type)) {
      problems.push(`console.${params.type}: ${params.args.map((arg) => arg.value ?? arg.description).join(' ')}`)
    } else if (method === 'Log.entryAdded' && ['error', 'warning'].includes(params.entry.level)) {
      problems.push(`log: ${params.entry.text} ${params.entry.url ?? ''}`)
    } else if (method === 'Network.responseReceived' && params.response.status >= 400) {
      problems.push(`http ${params.response.status}: ${params.response.url}`)
    }
  })

  await Promise.all(['Page.enable', 'Runtime.enable', 'Log.enable', 'Network.enable'].map((m) => cmd(m)))
  await cmd('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile })
  await cmd('Emulation.setTouchEmulationEnabled', { enabled: mobile })
  await cmd('Emulation.setFocusEmulationEnabled', { enabled: true })
  if (reducedMotion) {
    await cmd('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  }
  if (blockFonts) {
    await cmd('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*'] })
  }
  if (noWebgl) {
    await cmd('Page.addScriptToEvaluateOnNewDocument', {
      source: `const real = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
          return /webgl/.test(type) ? null : real.call(this, type, ...rest)
        }`,
    })
  }

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await cmd('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
    return result.value
  }

  const waitFor = async (expression, label = expression, timeout = 20000) => {
    const end = Date.now() + timeout
    for (;;) {
      const value = await evaluate(`!!(${expression})`)
      if (value) return value
      if (Date.now() > end) throw new Error(`Timed out waiting for ${label}`)
      await sleep(100)
    }
  }

  // Find a visible control by its text or aria-label, case-insensitively.
  const locate = (name, within) => `(() => {
    const wanted = ${JSON.stringify(name.toLowerCase())}
    const scope = ${within ? `document.querySelector(${JSON.stringify(within)})` : 'document'}
    const all = [...scope.querySelectorAll('button, a, input, [role=button]')]
    const label = (el) => [el.innerText, el.getAttribute('aria-label'), el.getAttribute('placeholder')].map((t) => (t ?? '').trim().replace(/\\s+/g, ' ').toLowerCase())
    const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' }
    const el = all.find((e) => visible(e) && label(e).includes(wanted)) ?? all.find((e) => visible(e) && label(e).some((t) => t.includes(wanted)))
    if (!el) return null
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })
    const r = el.getBoundingClientRect()
    const x = r.left + r.width / 2, y = r.top + r.height / 2
    const top = document.elementFromPoint(x, y)
    return { x, y, hit: !!top && (el === top || el.contains(top) || top.contains(el)), blocker: top ? top.tagName + '.' + String(top.className).slice(0, 60) : null }
  })()`

  const page = {
    problems,
    evaluate,
    waitFor,
    sleep,
    /** Network.emulateNetworkConditions: throughput in bytes per second. */
    async throttle(bytesPerSecond, latency = 150) {
      await cmd('Network.setCacheDisabled', { cacheDisabled: true })
      await cmd('Network.emulateNetworkConditions', {
        offline: false,
        latency,
        downloadThroughput: bytesPerSecond,
        uploadThroughput: bytesPerSecond,
      })
    },
    async goto(url) {
      await cmd('Page.navigate', { url })
      await waitFor(`document.readyState === 'complete'`, 'page load', 45000)
    },
    /** A real pointer press, so anything covering the control makes it fail. */
    async click(name, { timeout = 15000, within = null } = {}) {
      const end = Date.now() + timeout
      for (;;) {
        const spot = await evaluate(locate(name, within))
        if (spot?.hit) {
          await page.clickAt(spot.x, spot.y)
          return
        }
        if (Date.now() > end) {
          throw new Error(spot ? `"${name}" is covered by ${spot.blocker}` : `No visible control named "${name}"`)
        }
        await sleep(100)
      }
    },
    async clickAt(x, y) {
      const base = { x, y, button: 'left', clickCount: 1 }
      await cmd('Input.dispatchMouseEvent', { ...base, type: 'mouseMoved' })
      await cmd('Input.dispatchMouseEvent', { ...base, type: 'mousePressed' })
      await cmd('Input.dispatchMouseEvent', { ...base, type: 'mouseReleased' })
    },
    async tap(x, y) {
      await cmd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
      await sleep(40)
      await cmd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    },
    async drag(from, to, { steps = 8, touch = false } = {}) {
      if (touch) {
        await cmd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from[0], y: from[1] }] })
        for (let i = 1; i <= steps; i += 1) {
          const x = from[0] + ((to[0] - from[0]) * i) / steps
          const y = from[1] + ((to[1] - from[1]) * i) / steps
          await cmd('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] })
          await sleep(30)
        }
        return {
          release: () => cmd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
        }
      }
      await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from[0], y: from[1] })
      await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: from[0], y: from[1], button: 'left', clickCount: 1 })
      for (let i = 1; i <= steps; i += 1) {
        const x = from[0] + ((to[0] - from[0]) * i) / steps
        const y = from[1] + ((to[1] - from[1]) * i) / steps
        await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 })
        await sleep(30)
      }
      await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to[0], y: to[1], button: 'left', clickCount: 1 })
      return { release: async () => {} }
    },
    async key(key, { hold = 0 } = {}) {
      const code = key.length === 1 ? `Key${key.toUpperCase()}` : key
      const vk = { Escape: 27, Enter: 13, Tab: 9, ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38, ArrowDown: 40 }[key] ?? key.toUpperCase().charCodeAt(0)
      const base = { key, code, windowsVirtualKeyCode: vk }
      const text = key === 'Enter' ? { text: '\r' } : {}
      await cmd('Input.dispatchKeyEvent', { ...base, ...text, type: text.text ? 'keyDown' : 'rawKeyDown' })
      if (hold) await sleep(hold)
      await cmd('Input.dispatchKeyEvent', { ...base, type: 'keyUp' })
    },
    async type(text) {
      await cmd('Input.insertText', { text })
    },
    /** Forces garbage collection, then reports the live JS heap in megabytes. */
    async liveHeap() {
      await cmd('HeapProfiler.collectGarbage')
      await sleep(300)
      await cmd('HeapProfiler.collectGarbage')
      const { usedSize } = await cmd('Runtime.getHeapUsage')
      return Number((usedSize / 1048576).toFixed(1))
    },
    async screenshot(file) {
      const { data } = await cmd('Page.captureScreenshot', { format: 'png' })
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, Buffer.from(data, 'base64'))
      return data
    },
    /** Mean brightness (0–255) of a screen region, read from a real capture. */
    async brightness(x, y, size = 24) {
      const { data } = await cmd('Page.captureScreenshot', { format: 'png' })
      return evaluate(`(async () => {
        const image = new Image()
        image.src = 'data:image/png;base64,${data}'
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = ${size}
        const context = canvas.getContext('2d')
        context.drawImage(image, ${x} - ${size / 2}, ${y} - ${size / 2}, ${size}, ${size}, 0, 0, ${size}, ${size})
        const { data } = context.getImageData(0, 0, ${size}, ${size})
        let sum = 0
        for (let i = 0; i < data.length; i += 4) sum += (data[i] + data[i + 1] + data[i + 2]) / 3
        return sum / (data.length / 4)
      })()`)
    },
    async close() {
      listeners.delete(sessionId)
      await send('Target.closeTarget', { targetId })
    },
  }
  return page
}
