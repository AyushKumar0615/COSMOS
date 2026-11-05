import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { launchChrome, sleep } from './lib/chrome.mjs'
import { serveDist } from './lib/server.mjs'

/**
 * End-to-end checks against the production build, through the installed
 * Chrome and the headers in vercel.json. Screenshots of every state land in
 * tests/.output for review; frame rates and load figures in metrics.json.
 *
 * Set COSMOS_TEST_URL to run the same checks against a deployment instead,
 * with COSMOS_BYPASS holding its Deployment Protection bypass secret, if any.
 */
const root = path.resolve(import.meta.dirname, '..')
const output = path.join(root, 'tests/.output')
const metrics = {}

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  laptop: { width: 1024, height: 768 },
  tablet: { width: 820, height: 1180, mobile: true },
  phone: { width: 390, height: 844, mobile: true },
  landscape: { width: 844, height: 390, mobile: true },
}

let server
let chrome

before(async () => {
  fs.rmSync(output, { recursive: true, force: true })
  fs.mkdirSync(output, { recursive: true })
  server = process.env.COSMOS_TEST_URL
    ? { origin: process.env.COSMOS_TEST_URL, close() {} }
    : await serveDist(path.join(root, 'dist'), JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')))
  chrome = await launchChrome()
  if (process.env.COSMOS_BYPASS) {
    // Exchanged for a cookie on the deployment's own host, so the secret is
    // never sent to the third parties the page loads from.
    const page = await chrome.newPage(VIEWPORTS.desktop)
    await page.goto(`${server.origin}/?x-vercel-protection-bypass=${process.env.COSMOS_BYPASS}&x-vercel-set-bypass-cookie=true`)
    await page.close()
  }
})

after(async () => {
  fs.writeFileSync(path.join(output, 'metrics.json'), JSON.stringify(metrics, null, 2))
  await chrome.close()
  server.close()
})

async function open(options, query = '') {
  const page = await chrome.newPage(options)
  await page.goto(`${server.origin}/?debug${query}`)
  return page
}

const bodyText = `document.body.innerText.replace(/\\s+/g, ' ')`
const textIncludes = (text) => `${bodyText}.toLowerCase().includes(${JSON.stringify(text.toLowerCase())})`
const camera = (page) => page.evaluate(`__cosmos.camera.position.toArray()`)
const moved = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

async function enter(page) {
  await page.click('Enter Universe', { timeout: 20000 })
  await page.waitFor(`document.querySelector('[aria-label="Zoom in"]')`, 'solar system HUD')
  await sleep(2600)
}

async function navigate(page, label) {
  const collapsed = await page.evaluate(`innerWidth < 1280`)
  if (collapsed) {
    await page.click('Open menu')
    await sleep(500) // let the list finish unfolding, so the press lands on target
  }
  await page.click(label)
}

const GAUGE = `document.querySelector('[aria-label*="Schwarzschild radii"]')`

async function showPanel(page, name) {
  if (await page.evaluate(`!!document.querySelector('[aria-label="Hide information"]')`)) return
  await page.click(`About ${name}`)
  await page.waitFor(`document.querySelector('[aria-label="Hide information"]')`, 'information panel')
  await sleep(500)
}

async function hidePanel(page) {
  if (await page.evaluate(`!!document.querySelector('[aria-label="Hide information"]')`)) {
    await page.click('Hide information')
    await sleep(600)
  }
}

const openFirstResult = (page) => page.evaluate(`document.querySelector('[aria-label="Universe catalogue"] ul li button').click()`)

async function enterAtlas(page) {
  await page.waitFor(textIncludes('enter universe'), 'landing')
  await sleep(1500)
  await navigate(page, 'Universe')
  await page.waitFor(`document.querySelector('[aria-label="Search the universe"]')`, 'universe')
  await sleep(2400)
}

async function openObject(page, query) {
  await page.click('Search the universe')
  await page.waitFor(`document.querySelector('[aria-label="Universe catalogue"]')`, 'catalogue')
  await page.click('Search stars')
  await page.type(query)
  await sleep(300)
  await openFirstResult(page)
}

const setSlider = (page, value) =>
  page.evaluate(`(() => { const e = document.querySelector('input[type=range]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, ${value}); e.dispatchEvent(new Event('input', { bubbles: true })) })()`)

/** Nothing scrolls sideways and no control sits outside the viewport. */
async function assertLayout(page, state) {
  const issues = await page.evaluate(`(() => {
    const out = []
    if (document.documentElement.scrollWidth > innerWidth) out.push('page scrolls sideways')
    for (const el of document.querySelectorAll('button, a, input')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || getComputedStyle(el).visibility === 'hidden') continue
      if (el.closest('[class*="overflow-x"], [class*="overflow-y"], [class*="overflow-auto"]')) continue
      if (r.right > innerWidth + 1 || r.left < -1) out.push('off-screen: ' + (el.getAttribute('aria-label') || el.innerText.slice(0, 24)))
    }
    return out
  })()`)
  assert.deepEqual(issues, [], state)
}

async function snap(page, name, state) {
  await page.screenshot(path.join(output, name, `${state}.png`))
  await assertLayout(page, `${name}: ${state}`)
}

// First, on purpose: on a laptop, a long run warms the machine and lowers frame
// rates in every scene, which would be measuring the test run itself.
test('performance: load weight, frame rates and memory', { timeout: 90000 }, async () => {
  const page = await open(VIEWPORTS.desktop)
  await page.waitFor(textIncludes('enter universe'), 'landing')
  const paint = await page.evaluate(`performance.getEntriesByName('first-contentful-paint')[0]?.startTime`)
  const renderer = await page.evaluate(`(() => { const g = __cosmos.gl.getContext(); return g.getParameter(g.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL) })()`)
  const fps = `new Promise((done) => { let n = 0; const t = performance.now(); const f = () => { n += 1; performance.now() - t < 3000 ? requestAnimationFrame(f) : done(Math.round(n / 3)) }; requestAnimationFrame(f) })`

  await enter(page)
  const rates = { solar: await page.evaluate(fps) }
  await page.click('Galaxies')
  await page.waitFor(textIncludes('andromeda'), 'galaxies')
  await sleep(1600)
  rates.galaxies = await page.evaluate(fps)
  await page.click('Nebulae')
  await page.waitFor(textIncludes('carina'), 'nebulae')
  await sleep(1600)
  rates.nebulae = await page.evaluate(fps)
  await page.click('Black Holes')
  await page.waitFor(GAUGE, 'black holes')
  await sleep(2200)
  rates.blackHole = await page.evaluate(fps)
  await page.click('Phenomena')
  await page.waitFor(textIncludes('supernova'), 'phenomena')
  await sleep(2200)
  rates.supernova = await page.evaluate(fps)
  await page.click('Universe', { within: 'header' })
  await page.waitFor(`document.querySelector('[aria-label="Search the universe"]')`, 'universe')
  await sleep(2600)
  rates.universe = await page.evaluate(fps)
  await openObject(page, 'jupiter')
  await sleep(3600)
  rates.system = await page.evaluate(fps)

  const heapBefore = await page.liveHeap()
  for (let i = 0; i < 3; i += 1) {
    for (const scene of ['Universe', 'Galaxies', 'Black Holes', 'Nebulae']) {
      await page.click(scene, { within: 'header' })
      await sleep(2200)
    }
  }
  const heapAfter = await page.liveHeap()
  metrics.performance = {
    renderer,
    firstContentfulPaintMs: Math.round(paint),
    framesPerSecond: rates,
    heapMb: { before: heapBefore, after: heapAfter },
  }
  assert.ok(Object.values(rates).every((rate) => rate >= 30), JSON.stringify(rates))
  assert.ok(heapAfter - heapBefore < 4, `live heap grew from ${heapBefore} to ${heapAfter} MB`)
  assert.deepEqual(page.problems, [])
  await page.close()
})

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test(`walkthrough at ${name} (${viewport.width}x${viewport.height})`, { timeout: 260000 }, async () => {
    const page = await open(viewport)
    await page.waitFor(textIncludes('enter universe'), 'landing', 20000)
    await sleep(2200)
    await snap(page, name, '01-landing')
    assert.deepEqual(await page.evaluate(`(() => {
      const header = document.querySelector('header button').getBoundingClientRect()
      const title = document.querySelector('h1').getBoundingClientRect()
      const cta = [...document.querySelectorAll('button')].find((b) => /enter universe/i.test(b.innerText)).getBoundingClientRect()
      return { clearOfHeader: title.top >= header.bottom - 4 || title.left >= header.right, onScreen: cta.bottom <= innerHeight }
    })()`), { clearOfHeader: true, onScreen: true }, 'landing content fits')

    if (viewport.width < 1280) {
      await page.click('Open menu')
      await sleep(600)
      await snap(page, name, '02-menu')
      assert.ok(await page.evaluate(`(() => {
        const menu = document.querySelector('#mobile-nav')
        const fits = menu.getBoundingClientRect().bottom <= innerHeight
        return fits && (menu.scrollHeight <= menu.clientHeight || getComputedStyle(menu).overflowY === 'auto')
      })()`), 'every menu item can be reached')
      await page.click('Close menu')
      await sleep(500)
    }

    await enter(page)
    await snap(page, name, '03-solar')

    // The chip row steps aside for the panel on small screens, so the rest of
    // the system is walked with the panel's own Next control.
    await page.click('Sun')
    await page.waitFor(textIncludes('diameter'), 'Sun panel')
    for (const body of ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']) {
      await sleep(250)
      await page.click(`Next: ${body}`)
      await page.waitFor(textIncludes(body), `${body} panel`)
    }
    await sleep(1800)
    await snap(page, name, '04-planet')

    await navigate(page, 'Guided Tours')
    await page.waitFor(textIncludes('1 / 10'), 'tour start')
    await sleep(1500)
    await snap(page, name, '05-tour')
    for (let stop = 2; stop <= 10; stop += 1) {
      await page.click('Next')
      await page.waitFor(textIncludes(`${String(stop).padStart(2, '0')} / 10`), `tour stop ${stop}`)
    }
    await page.click('Exit tour')
    await sleep(600)

    await navigate(page, 'Free Flight')
    await page.waitFor(textIncludes('speed'), 'flight HUD')
    await sleep(800)
    await snap(page, name, '06-flight')
    await page.click('Exit flight')
    await sleep(300)

    await navigate(page, 'Galaxies')
    await page.waitFor(textIncludes('andromeda'), 'galaxies')
    await sleep(1600)
    await snap(page, name, '07-galaxies')
    for (const galaxy of ['Andromeda', 'Whirlpool']) {
      await page.click(galaxy)
      await sleep(1300)
    }
    await snap(page, name, '08-whirlpool')

    await navigate(page, 'Nebulae')
    await page.waitFor(textIncludes('carina'), 'nebulae')
    await sleep(1600)
    for (const nebula of ['Crab', 'Eagle', 'Carina']) {
      await page.click(nebula)
      await sleep(1300)
    }
    await snap(page, name, '09-nebula')

    await navigate(page, 'Black Holes')
    await page.waitFor(GAUGE, 'black hole gauge')
    await sleep(2200)
    await snap(page, name, '09a-black-hole')
    await showPanel(page, 'M87*')
    await page.click('Science')
    await page.waitFor(textIncludes('hawking temperature'), 'science tab')
    await sleep(400)
    await snap(page, name, '09b-science')
    await page.click('Missions', { within: '[role=tablist]' })
    await page.waitFor(textIncludes('approach the event horizon'), 'missions tab')
    await sleep(400)
    await snap(page, name, '09c-black-hole-missions')
    await hidePanel(page)
    await page.click('Enter')
    await page.waitFor(textIncludes('ray-traced simulation'), 'descent')
    await page.click('Pause descent')
    await sleep(500)
    await snap(page, name, '09d-descent')
    await page.click('Interior')
    await page.waitFor(textIncludes('hypothetical visualization'), 'interior label')
    await sleep(900)
    await snap(page, name, '09e-interior')
    await page.click('Return to exterior')
    await page.waitFor(GAUGE, 'back outside')

    await navigate(page, 'Phenomena')
    await page.waitFor(textIncludes('supernova'), 'phenomena')
    await sleep(1800)
    await snap(page, name, '09f-supernova')
    for (const [entry, state] of [['Neutron Star', 'pulsar'], ['Wormhole', 'wormhole'], ['Curved Spacetime', 'spacetime'], ['Cosmic Scale', 'scale'], ['55 Cancri e', 'exoplanet']]) {
      await hidePanel(page)
      await page.click(entry)
      await sleep(1600)
      await snap(page, name, `09g-${state}`)
      // The experience's dock must not cover the way to its information.
      await showPanel(page, entry)
    }

    await hidePanel(page)
    await page.click('Life of a Star')
    await sleep(1600)
    await snap(page, name, '09h-life-cycle')

    await navigate(page, 'Universe')
    await page.waitFor(`document.querySelector('[aria-label="Search the universe"]')`, 'universe')
    await sleep(2600)
    await snap(page, name, '09i-universe')
    await page.click('Search the universe')
    await page.waitFor(`document.querySelector('[aria-label="Universe catalogue"]')`, 'catalogue')
    await sleep(500)
    await snap(page, name, '09j-catalogue')
    await page.click('Search stars')
    await page.type('titan')
    await sleep(400)
    await openFirstResult(page)
    await page.waitFor(`document.querySelector('aside[aria-label="Titan"]')`, 'Titan profile')
    await sleep(3000)
    await snap(page, name, '09k-system')
    await page.click('Universe', { within: '.top-20' })
    await sleep(1200)

    await navigate(page, 'Missions')
    await page.waitFor(textIncludes('mission archive'), 'missions')
    await sleep(1800)
    await snap(page, name, '10-missions')
    await page.click('Search missions')
    await page.type('voyager')
    await sleep(500)
    await page.waitFor(`${bodyText}.includes('Voyager 2') && !${bodyText}.includes('Apollo 11')`, 'search narrows the list')
    await page.click('Voyager 2')
    await page.waitFor(`document.querySelector('[role=dialog]')`, 'mission dialog')
    await sleep(900)
    await snap(page, name, '11-mission-detail')
    await page.key('Escape')
    await page.waitFor(`!document.querySelector('[role=dialog]')`, 'dialog closed')
    assert.ok(await page.evaluate(textIncludes('mission archive')), 'Esc must stay in the archive')

    await navigate(page, 'About')
    await page.waitFor(`document.querySelector('[role=dialog]')`, 'about panel')
    await sleep(800)
    await snap(page, name, '12-about')
    await page.key('Escape')
    await page.waitFor(`!document.querySelector('[role=dialog]')`, 'about closed')

    await navigate(page, 'Home')
    await page.waitFor(textIncludes('enter universe'), 'back on the landing page')
    assert.deepEqual(page.problems, [])
    await page.close()
  })
}

async function enterBlackHoles(page) {
  await page.waitFor(textIncludes('enter universe'), 'landing')
  await sleep(1500)
  await page.click('fall straight into a black hole')
  await page.waitFor(GAUGE, 'black holes')
  await sleep(2400)
}

test('the shadow is dark, and the lensed disc arcs above it', { timeout: 60000 }, async () => {
  const page = await open(VIEWPORTS.desktop, '&quality=high')
  await enterBlackHoles(page)
  await hidePanel(page)
  await page.click('Sagittarius A*')
  await sleep(3200)
  const centre = await page.evaluate(`(() => { const p = __cosmos.camera.position.clone().multiplyScalar(0).project(__cosmos.camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight] })()`)
  const shadow = await page.brightness(centre[0], centre[1] - 18, 10)
  const above = []
  for (const dy of [70, 90, 110, 130]) above.push(await page.brightness(centre[0], centre[1] - dy, 12))
  // Relative, because Sagittarius A*'s faint flow lies in front of its shadow.
  assert.ok(Math.max(...above) > 90, `the lensed disc should arc above the shadow: ${above}`)
  assert.ok(shadow < Math.max(...above) / 3, `shadow ${shadow} against disc ${above}`)
  assert.deepEqual(page.problems, [])
  await page.close()
})

test('guided descent: labelled stages, the horizon, and a way back', { timeout: 90000 }, async () => {
  const page = await open(VIEWPORTS.desktop)
  await enterBlackHoles(page)
  await hidePanel(page)
  const before = await camera(page)
  await page.click('Enter')
  await page.waitFor(textIncludes('ray-traced simulation'), 'descent')
  await page.waitFor(`__cosmos.camera.position.length() < ${Math.hypot(...before) - 1}`, 'falling inward', 12000)

  await page.click('Pause descent')
  await page.click('Photon sphere')
  await sleep(500)
  const atPhoton = await page.evaluate(`__cosmos.camera.position.length()`)
  assert.ok(atPhoton > 1 && atPhoton < 7, `radius ${atPhoton}`)
  assert.ok(await page.evaluate(`!${textIncludes('hypothetical')}`), 'exterior is a simulation, not hypothetical')

  await page.click('Interior')
  await page.waitFor(textIncludes('hypothetical visualization'), 'interior labelled as hypothetical')
  assert.ok(await page.evaluate(textIncludes('not observed, not calculated')))
  await setSlider(page, 1)
  await page.waitFor(textIncludes('could not come back'), 'the honest ending')

  await page.key('Escape')
  await page.waitFor(GAUGE, 'Esc returns to the exterior')
  await sleep(600)
  const r = await page.evaluate(`__cosmos.camera.position.length()`)
  assert.ok(r > 20, `the camera should be back outside, at ${r}`)
  assert.deepEqual(page.problems, [])
  await page.close()
})

test('all five black hole missions can be completed', { timeout: 60000 }, async () => {
  const page = await open(VIEWPORTS.desktop)
  await page.evaluate(`localStorage.clear()`)
  await enterBlackHoles(page)
  await page.click('Fly freely')
  await page.waitFor(textIncludes('exit flight'), 'flight')
  const place = (x, y, z) => page.evaluate(`__cosmos.camera.position.set(${x}, ${y}, ${z}), 0`)
  await place(20, 0.5, 0)
  await sleep(3800)
  await place(5, 2, 0)
  await sleep(350)
  await place(5, -2, 0)
  await sleep(350)
  await place(0, 0.2, 1.5)
  await sleep(5600)
  await place(0, 0.2, 1.25)
  await sleep(3600)
  const saved = await page.evaluate(`JSON.parse(localStorage.getItem('cosmos.blackhole.missions.v1') ?? '[]')`)
  assert.deepEqual([...saved].sort(), ['dilation', 'disk', 'horizon', 'lensing', 'photon'])
  assert.deepEqual(page.problems, [])
  await page.close()
})

test('free flight cannot cross the horizon', { timeout: 40000 }, async () => {
  const page = await open(VIEWPORTS.desktop)
  await enterBlackHoles(page)
  await page.click('Fly freely')
  await page.waitFor(textIncludes('exit flight'), 'flight')
  await page.evaluate(`__cosmos.camera.position.set(0, 0, 0.6), 0`)
  await sleep(300)
  assert.ok((await page.evaluate(`__cosmos.camera.position.length()`)) >= 1.1)
  await page.close()
})

test('reduced motion: the descent waits for the visitor', { timeout: 40000 }, async () => {
  const page = await open({ ...VIEWPORTS.desktop, reducedMotion: true })
  await page.waitFor(textIncludes('fall straight'), 'landing', 4000)
  await page.click('fall straight into a black hole')
  await page.waitFor(GAUGE, 'black holes')
  await sleep(600)
  await page.click('Enter')
  await page.waitFor(textIncludes('ray-traced simulation'), 'descent')
  await sleep(300)
  const first = await page.evaluate(`__cosmos.camera.position.length()`)
  await sleep(1500)
  assert.equal(await page.evaluate(`__cosmos.camera.position.length()`), first, 'nothing moves by itself')
  await page.click('Photon sphere')
  await sleep(300)
  assert.ok((await page.evaluate(`__cosmos.camera.position.length()`)) < first, 'steps work')
  assert.deepEqual(page.problems, [])
  await page.close()
})

test('without WebGL the black hole facts stay, and 3D-only controls go', { timeout: 40000 }, async () => {
  const page = await open({ ...VIEWPORTS.desktop, noWebgl: true })
  await page.waitFor(textIncludes('webgl is unavailable'), 'fallback')
  await sleep(1200)
  await page.click('Black Holes')
  await page.waitFor(textIncludes('first image'), 'facts')
  assert.equal(await page.evaluate(`[...document.querySelectorAll('button')].some((b) => b.innerText.trim().toLowerCase() === 'enter')`), false)
  await page.click('Science')
  await page.waitFor(textIncludes('hawking temperature'), 'science')
  assert.deepEqual(page.problems, [])
  await page.close()
})

test('the lab: supernova timeline, wormhole travel, spacetime and scale', { timeout: 60000 }, async () => {
  const page = await open(VIEWPORTS.desktop)
  await page.waitFor(textIncludes('enter universe'), 'landing')
  await sleep(1500)
  await page.click('Phenomena')
  await page.waitFor(textIncludes('red supergiant'), 'supernova')
  await sleep(1800)
  await page.click('Pause simulation')
  await setSlider(page, 0.5)
  await page.waitFor(textIncludes('expanding ejecta'), 'timeline scrubbing')

  await page.click('Wormhole')
  await page.waitFor(textIncludes('near side'), 'wormhole')
  await sleep(1600)
  await page.click('Go through')
  await page.waitFor(textIncludes('far side'), 'arrived on the far side', 12000)

  await page.click('Curved Spacetime')
  await page.waitFor(textIncludes('click the grid'), 'spacetime')
  await sleep(1900)
  const before = await page.brightness(560, 420, 60)
  await page.clickAt(560, 420)
  await sleep(600)
  assert.notEqual(await page.brightness(560, 420, 60), before, 'placing a mass changes the grid')

  await page.click('Cosmic Scale')
  await page.waitFor(textIncludes('across'), 'scale')
  await sleep(1600)
  await setSlider(page, 26.65)
  await page.waitFor(textIncludes('observable universe'), 'the far end of the scale')
  assert.deepEqual(page.problems, [])
  await page.close()
})

test('scenes release their GPU memory', { timeout: 90000 }, async () => {
  const page = await open(VIEWPORTS.desktop)
  await page.waitFor(textIncludes('enter universe'), 'landing')
  await sleep(1500)
  const memory = () => page.evaluate(`({ ...__cosmos.gl.info.memory, programs: __cosmos.gl.info.programs.length })`)
  const cycle = async () => {
    for (const scene of ['Black Holes', 'Phenomena', 'Universe', 'Galaxies', 'Nebulae']) {
      await page.click(scene, { within: 'header' })
      await sleep(2500)
    }
  }
  await cycle()
  const first = await memory()
  await cycle()
  await cycle()
  const later = await memory()
  metrics.gpuMemory = { first, later }
  assert.ok(later.geometries <= first.geometries + 3, JSON.stringify({ first, later }))
  assert.ok(later.textures <= first.textures + 3, JSON.stringify({ first, later }))
  assert.deepEqual(page.problems, [])
  await page.close()
})

test('universe: stars are drawn as one GPU layer, and labels show real objects', { timeout: 40000 }, async () => {
  const page = await open(VIEWPORTS.desktop, '&quality=high')
  await enterAtlas(page)
  await sleep(600)
  const info = await page.evaluate(`({ points: __cosmos.gl.info.render.points, calls: __cosmos.gl.info.render.calls, labels: [...document.querySelectorAll('button[data-id]')].filter((b) => b.style.opacity === '1').length })`)
  assert.ok(info.points > 100000, `points ${info.points}`)
  assert.ok(info.calls < 30, `draw calls ${info.calls}`)
  assert.ok(info.labels > 5, `labels ${info.labels}`)
  assert.deepEqual(page.problems, [])
  await page.close()
})

test('catalogue: filter, sort, search, profile and connected navigation', { timeout: 60000 }, async () => {
  const page = await open(VIEWPORTS.desktop)
  await page.evaluate(`localStorage.clear()`)
  await enterAtlas(page)
  await page.click('Search the universe')
  await page.waitFor(`document.querySelector('[aria-label="Universe catalogue"]')`, 'catalogue')
  const rows = () => page.evaluate(`document.querySelectorAll('[aria-label="Universe catalogue"] ul li').length`)
  const all = await rows()
  assert.ok(all > 150, `rows ${all}`)
  await page.click('Exoplanets')
  await sleep(200)
  assert.ok((await rows()) > 30)
  await page.evaluate(`(() => { const s = document.querySelector('select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'temperature'); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await page.click('Sort ascending')
  await sleep(200)
  const first = await page.evaluate(`document.querySelector('[aria-label="Universe catalogue"] ul li').innerText`)
  assert.match(first, /KELT-9 b/, 'hottest first')

  await page.evaluate(`[...document.querySelectorAll('[aria-label="Universe catalogue"] button[aria-pressed]')].find((b) => /^All/.test(b.innerText)).click()`)
  await page.click('Search stars')
  await page.type('jupiter')
  await sleep(300)
  await page.evaluate(`[...document.querySelectorAll('[aria-label="Universe catalogue"] ul li button')].find((b) => /^Jupiter/.test(b.innerText)).click()`)
  await page.waitFor(`document.querySelector('aside[aria-label="Jupiter"]')`, 'Jupiter profile')
  await page.waitFor(textIncludes('jpl solar system dynamics'), 'its source')
  await sleep(2600)
  await page.click('View its moons')
  await page.waitFor(textIncludes('back to solar system'), 'moons of Jupiter')
  await sleep(1400)
  await page.click('Next: ')
  await sleep(1000)
  assert.ok(await page.evaluate(`!!document.querySelector('aside[aria-label]')`))
  await page.click('Back to Solar System')
  await sleep(1400)
  await page.key('Escape')
  await page.waitFor(`!document.querySelector('aside[aria-label]')`, 'Esc returns to the universe')
  assert.deepEqual(page.problems, [])
  await page.close()
})

test('bookmarks, compare and discoveries persist across a reload', { timeout: 60000 }, async () => {
  const page = await open(VIEWPORTS.desktop)
  await page.evaluate(`localStorage.clear()`)
  await page.goto(`${server.origin}/?debug`)
  await enterAtlas(page)
  await page.click('Search the universe')
  await page.waitFor(`document.querySelector('[aria-label="Universe catalogue"]')`, 'catalogue')
  await page.click('Compare Earth')
  await page.click('Compare Jupiter')
  await page.click('Bookmark Saturn')
  await page.evaluate(`[...document.querySelectorAll('footer button')].find((b) => b.innerText === 'Compare').click()`)
  await page.waitFor(textIncludes('drawn to true relative scale'), 'true-scale compare')
  await page.click('Close compare')
  await page.click('Close catalogue')
  await sleep(200)
  await openObject(page, 'sirius')
  await sleep(1800)
  await openObject(page, 'betelgeuse')
  await sleep(1500)
  const saved = await page.evaluate(`JSON.parse(localStorage.getItem('cosmos.discovery.v1'))`)
  assert.ok(saved.distanceLy > 400, `distance ${saved.distanceLy}`)
  assert.deepEqual(saved.bookmarks, ['saturn'])
  assert.ok(saved.badges.includes('first-light') && saved.badges.includes('comparative'), JSON.stringify(saved.badges))

  await page.goto(`${server.origin}/?debug`)
  await enterAtlas(page)
  await page.click('Open discoveries')
  await page.waitFor(textIncludes('discovery log'), 'discoveries')
  assert.ok(await page.evaluate(textIncludes('betelgeuse')), 'the log survives a reload')
  assert.deepEqual(page.problems, [])
  await page.close()
})

test('universe works without WebGL and with reduced motion', { timeout: 60000 }, async () => {
  const plain = await open({ ...VIEWPORTS.desktop, noWebgl: true })
  await plain.waitFor(textIncludes('webgl is unavailable'), 'fallback')
  await sleep(1200)
  await plain.click('Universe', { within: 'header' })
  await plain.waitFor(`document.querySelector('[aria-label="Search the universe"]')`, 'universe')
  await openObject(plain, 'vega')
  await plain.waitFor(`document.querySelector('aside[aria-label="Vega"]')`, 'facts without 3D')
  assert.deepEqual(plain.problems, [])
  await plain.close()

  const still = await open({ ...VIEWPORTS.desktop, reducedMotion: true })
  await still.waitFor(textIncludes('enter universe'), 'landing', 4000)
  await still.click('Universe', { within: 'header' })
  await still.waitFor(`document.querySelector('[aria-label="Search the universe"]')`, 'universe')
  await sleep(600)
  await openObject(still, 'saturn')
  await still.waitFor(`document.querySelector('aside[aria-label="Saturn"]')`, 'instant arrival', 3000)
  assert.deepEqual(still.problems, [])
  await still.close()
})

test('touring many systems does not grow GPU memory without limit', { timeout: 120000 }, async () => {
  const page = await open(VIEWPORTS.desktop)
  await enterAtlas(page)
  const memory = () => page.evaluate(`({ ...__cosmos.gl.info.memory })`)
  const worlds = ['trappist-1 b', 'kepler-16', 'hr 8799 b', 'wasp-12', 'gj 1214', 'toi-700 d', 'titan', 'triton', 'pluto', '51 peg', 'kelt-9', 'k2-18', 'hd 209458', 'lhs 1140 b']
  for (const world of worlds) {
    await openObject(page, world)
    await sleep(1900)
  }
  const first = await memory()
  for (const world of [...worlds].reverse()) {
    await openObject(page, world)
    await sleep(1500)
  }
  const later = await memory()
  metrics.atlasGpuMemory = { first, later }
  assert.ok(later.textures <= 90, JSON.stringify({ first, later }))
  assert.ok(later.geometries <= first.geometries + 40, JSON.stringify({ first, later }))
  assert.deepEqual(page.problems, [])
  await page.close()
})

test('a tour requested from the landing page starts after entry', { timeout: 40000 }, async () => {
  const page = await open(VIEWPORTS.desktop)
  await page.waitFor(textIncludes('enter universe'), 'landing')
  await sleep(1500)
  await page.click('Guided Tours')
  await page.waitFor(textIncludes('1 / 10'), 'tour', 15000)
  assert.deepEqual(page.problems, [])
  await page.close()
})

test('keyboard: planets, flight and mission cards', { timeout: 60000 }, async () => {
  const page = await open(VIEWPORTS.desktop)
  await enter(page)

  await page.key('ArrowRight')
  await page.waitFor(textIncludes('diameter'), 'Sun panel from the arrow key')
  await page.key('ArrowRight')
  await page.waitFor(textIncludes('01 / 08'), 'Mercury panel')
  await page.key('Escape')
  await page.waitFor(`!${textIncludes('01 / 08')}`, 'panel closed by Esc')
  assert.ok(await page.evaluate(`!!document.querySelector('[aria-label="Zoom in"]')`), 'Esc closes the panel, not the scene')

  await page.click('Free Flight')
  await page.waitFor(textIncludes('speed'), 'flight HUD')
  await sleep(1000)
  const start = await camera(page)
  await page.key('w', { hold: 900 })
  await sleep(300)
  assert.ok(moved(start, await camera(page)) > 0.5, 'W moves the camera')
  await page.key('Escape')
  await page.waitFor(`!${textIncludes('exit flight')}`, 'Esc leaves flight')

  await page.click('Missions')
  await page.waitFor(textIncludes('mission archive'), 'missions')
  await sleep(1500)
  await page.evaluate(`[...document.querySelectorAll('button')].find((b) => /voyager 1/i.test(b.innerText)).focus()`)
  await page.key('Enter')
  await page.waitFor(`document.querySelector('[role=dialog]')`, 'card opened with Enter')
  await sleep(400)
  for (let i = 0; i < 12; i += 1) await page.key('Tab')
  assert.ok(await page.evaluate(`document.querySelector('[role=dialog]').contains(document.activeElement)`), 'focus stays in the dialog')
  await page.key('Escape')
  await page.waitFor(`!document.querySelector('[role=dialog]')`, 'closed')
  await sleep(300)
  assert.match(await page.evaluate(`document.activeElement.innerText`), /Voyager 1/, 'focus returns to the card')
  assert.deepEqual(page.problems, [])
  await page.close()
})

test('touch: joystick moves and dragging looks around', { timeout: 60000 }, async () => {
  const page = await open(VIEWPORTS.phone)
  await page.waitFor(textIncludes('enter universe'), 'landing')
  await sleep(1500)
  await enter(page)
  await navigate(page, 'Free Flight')
  await page.waitFor(textIncludes('exit flight'), 'flight HUD')
  await sleep(1000)

  const start = await camera(page)
  const pad = await page.evaluate(`(() => { const r = document.querySelector('[aria-label*="oystick" i], [role=application], [data-joystick]')?.getBoundingClientRect(); return r ? [r.left + r.width / 2, r.top + r.height / 2] : [96, 708] })()`)
  const hold = await page.drag(pad, [pad[0], pad[1] - 50], { touch: true })
  await sleep(1200)
  await hold.release()
  assert.ok(moved(start, await camera(page)) > 0.5, 'joystick moves the camera')

  const look = await page.evaluate(`__cosmos.camera.quaternion.toArray()`)
  const swipe = await page.drag([200, 400], [280, 420], { touch: true })
  await swipe.release()
  await sleep(500)
  assert.ok(moved(look, await page.evaluate(`__cosmos.camera.quaternion.toArray()`)) > 0.005, 'a drag turns the camera')
  assert.deepEqual(page.problems, [])
  await page.close()
})

test('mission toolbar sticks only when the viewport can spare the room', { timeout: 60000 }, async () => {
  for (const [viewport, expected] of [[VIEWPORTS.laptop, 'sticky'], [VIEWPORTS.landscape, 'static']]) {
    const page = await open(viewport)
    await page.waitFor(textIncludes('enter universe'), 'landing')
    await sleep(1500)
    await navigate(page, 'Missions')
    await page.waitFor(textIncludes('mission archive'), 'missions')
    await sleep(1500)
    const position = await page.evaluate(`getComputedStyle(document.querySelector('input[type=search], input').closest('[class*="z-[2]"]')).position`)
    assert.equal(position, expected)
    await page.close()
  }
})

const nearestPlanet = `(() => {
  const camera = __cosmos.camera, v = camera.position.clone(); let best = null
  __cosmos.scene.traverse((o) => {
    if (!o.isMesh || !o.material?.isMeshStandardMaterial || !o.material.map) return
    o.getWorldPosition(v)
    const d = v.distanceTo(camera.position)
    if (!best || d < best.d) { const p = v.clone().project(camera); best = { d, x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight } }
  })
  return best
})()`

test('planets come back after the GPU context is lost and restored', { timeout: 60000 }, async () => {
  const page = await open(VIEWPORTS.desktop, '&quality=high')
  await enter(page)
  await page.click('Jupiter')
  await sleep(3500)
  const spot = await page.evaluate(nearestPlanet)
  const before = await page.brightness(spot.x, spot.y)
  assert.ok(before > 40, `Jupiter should be lit before the test (${before})`)

  await page.evaluate(`window.__lose = __cosmos.gl.getContext().getExtension('WEBGL_lose_context'); __lose.loseContext()`)
  await sleep(1000)
  await page.evaluate(`__lose.restoreContext()`)
  await sleep(1500)

  const now = await page.evaluate(nearestPlanet)
  const after = await page.brightness(now.x, now.y)
  await page.screenshot(path.join(output, 'context-restored.png'))
  assert.ok(after > before * 0.7, `Jupiter was ${before.toFixed(1)} and is now ${after.toFixed(1)}`)
  assert.ok(await page.evaluate(`__cosmos.gl.info.memory.textures`) > 0)
  await page.close()
})

test('a context that never returns falls back to the static backdrop', { timeout: 40000 }, async () => {
  const page = await open(VIEWPORTS.desktop)
  await enter(page)
  await page.evaluate(`__cosmos.gl.getContext().getExtension('WEBGL_lose_context').loseContext()`)
  await page.waitFor(`!document.querySelector('canvas')`, 'canvas replaced', 9000)
  assert.ok(await page.evaluate(`!!document.querySelector('[aria-label="Zoom in"]')`), 'the interface stays up')
  await page.close()
})

test('without WebGL the site stays usable', { timeout: 60000 }, async () => {
  const page = await open({ ...VIEWPORTS.desktop, noWebgl: true })
  await page.waitFor(textIncludes('webgl is unavailable'), 'fallback notice')
  await sleep(1500)
  assert.equal(await page.evaluate(`document.querySelectorAll('canvas').length`), 0)
  await page.screenshot(path.join(output, 'no-webgl.png'))
  await page.click('Enter Universe')
  await page.waitFor(`document.querySelector('[aria-label="Zoom in"]')`, 'HUD')
  await page.click('Saturn')
  await page.waitFor(textIncludes('diameter'), 'facts without 3D')
  await navigate(page, 'Missions')
  await page.waitFor(textIncludes('mission archive'), 'missions without 3D')
  await sleep(1200)
  assert.deepEqual(page.problems, [])
  await page.close()
})

test('reduced motion: no intro delay and a frozen system', { timeout: 40000 }, async () => {
  const page = await open({ ...VIEWPORTS.desktop, reducedMotion: true })
  await page.waitFor(textIncludes('enter universe'), 'landing', 4000)
  await page.click('Enter Universe')
  await page.waitFor(`document.querySelector('[aria-label="Zoom in"]')`, 'immediate entry', 2000)
  await sleep(800)
  const read = `(() => { const out = []; __cosmos.scene.traverse((o) => { if (o.isMesh && o.material?.isMeshStandardMaterial && o.material.map) { const p = o.getWorldPosition(__cosmos.camera.position.clone()); out.push(p.x, p.z) } }); return out })()`
  const first = await page.evaluate(read)
  await sleep(1200)
  assert.deepEqual(await page.evaluate(read), first, 'planets hold still')
  assert.deepEqual(page.problems, [])
  await page.close()
})

test('still works when Google Fonts is unreachable', { timeout: 30000 }, async () => {
  const page = await open({ ...VIEWPORTS.desktop, blockFonts: true })
  await enter(page)
  await page.click('Earth')
  await page.waitFor(textIncludes('diameter'), 'panel')
  assert.deepEqual(page.problems.filter((problem) => !/fonts\.g|ERR_BLOCKED|net::/.test(problem)), [])
  await page.close()
})

test('unknown paths fall back to the app; missing assets are real 404s', { timeout: 20000 }, async () => {
  const headers = process.env.COSMOS_BYPASS ? { 'x-vercel-protection-bypass': process.env.COSMOS_BYPASS } : {}
  const fetch = (url) => globalThis.fetch(url, { headers })
  const deep = await fetch(`${server.origin}/some/deep/link`)
  assert.equal(deep.status, 200)
  assert.match(await deep.text(), /<div id="root">/)
  assert.equal((await fetch(`${server.origin}/assets/missing.js`)).status, 404)
  for (const file of ['robots.txt', 'sitemap.xml', 'og-image.png', 'cosmos.svg', 'apple-touch-icon.png', 'favicon-32.png']) {
    assert.equal((await fetch(`${server.origin}/${file}`)).status, 200, file)
  }
})

// Local only: the test server sends files uncompressed, which is what makes
// Three.js slow enough to outlast the intro. A compressed deployment delivers
// it first, so there the order proves nothing either way.
test('on a slow connection the landing page does not wait for Three.js', { timeout: 60000, skip: Boolean(process.env.COSMOS_TEST_URL) }, async () => {
  const page = await chrome.newPage(VIEWPORTS.desktop)
  await page.throttle(200000) // 1.6 Mbps
  await page.goto(`${server.origin}/?debug`)
  await page.waitFor(textIncludes('enter universe'), 'landing', 30000)
  assert.equal(await page.evaluate(`!!window.__cosmos`), false, 'landing should be up before the 3D engine')
  await page.waitFor(`window.__cosmos`, 'the 3D engine to arrive afterwards', 30000)
  assert.deepEqual(page.problems, [])
  await page.close()
})
