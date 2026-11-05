import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import StaticSpaceFallback from './components/interface/StaticSpaceFallback.jsx'
import Navbar from './components/layout/Navbar.jsx'
import Loader from './components/interface/Loader.jsx'
import Landing from './components/interface/Landing.jsx'
import UniverseHud from './components/interface/UniverseHud.jsx'
import TourHud from './components/interface/TourHud.jsx'
import FlightHud from './components/interface/FlightHud.jsx'
import AboutPanel from './components/interface/AboutPanel.jsx'
import Toast from './components/interface/Toast.jsx'
import HudFrame from './components/interface/HudFrame.jsx'
import SystemTransition from './components/interface/SystemTransition.jsx'
import TravelOverlay from './components/interface/TravelOverlay.jsx'
import { BODY_ORDER } from './data/planets.js'
import { TOUR_DWELL_SECONDS, TOUR_INDEX_BY_BODY, TOUR_STOPS } from './data/tour.js'
import { BLACK_HOLE_IDS, GALAXY_IDS, NEBULA_IDS, PHENOMENON_IDS } from './data/navigation.js'
import { FLIGHT_SPEED } from './data/flight.js'
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion.js'
import { useMediaQuery, useTouchLayout } from './hooks/useMediaQuery.js'
import { useTourTimer } from './hooks/useTourTimer.js'
import { detectWebGL } from './lib/webgl.js'
import { recordDescent, recordVisit } from './lib/discovery.js'

// Three.js and the scenes are a large chunk. Loading them lazily lets the
// interface and the entry transition paint first.
const SceneCanvas = lazy(() => import('./components/3d/SceneCanvas.jsx'))
// The mission archive (data, artwork, dialog) is its own chunk too.
const loadMissionExplorer = () => import('./components/missions/MissionExplorer.jsx')
const MissionExplorer = lazy(loadMissionExplorer)
// So are the black hole and lab interfaces, with their data.
const loadBlackHoleLayer = () => import('./components/interface/BlackHoleLayer.jsx')
const BlackHoleLayer = lazy(loadBlackHoleLayer)
const loadAtlasLayer = () => import('./components/interface/atlas/AtlasLayer.jsx')
const AtlasLayer = lazy(loadAtlasLayer)
const loadDeepSpaceLayer = () => import('./components/interface/DeepSpaceLayer.jsx')
const DeepSpaceLayer = lazy(loadDeepSpaceLayer)
const loadPhenomenaHud = () => import('./components/interface/PhenomenaHud.jsx')
const PhenomenaHud = lazy(loadPhenomenaHud)

// loading -> landing -> entering -> universe -> exiting -> landing
// The camera itself reports when a move has finished; these are only
// backstops in case the scene never mounts to report it.
const ENTER_FALLBACK = 9000
const EXIT_FALLBACK = 7000
const ENTER_DURATION = 2100
const ZOOM_STEP = 0.72

// Scene changes fade through black: in, hold while the next scene builds, out.
const TRAVEL_IN_MS = 450
const TRAVEL_HOLD_MS = 700
const TRAVEL_OUT_MS = 450

const SCENE_LABELS = {
  solar: 'Travelling to the solar system',
  galaxies: 'Travelling to the galaxies',
  nebulae: 'Travelling to the nebulae',
  'black-holes': 'Travelling to the black holes',
  phenomena: 'Opening the phenomena lab',
  universe: 'Opening the universe',
  missions: 'Opening the mission archive',
}

const cycle = (list, currentId, step) => {
  const index = list.findIndex((entry) => (entry.id ?? entry) === currentId)
  const next = list[(Math.max(0, index) + step + list.length) % list.length]
  return next.id ?? next
}

function MissionsLoading() {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center" role="status">
      <span className="readout animate-pulse">Loading mission archive</span>
    </div>
  )
}

export default function App() {
  const reducedMotion = usePrefersReducedMotion()
  const touch = useTouchLayout()
  // Panels become bottom sheets below this width. A tablet is touch-first but
  // still has side panels, so the two questions need separate answers.
  const bottomSheets = useMediaQuery('(max-width: 767px)')

  const [phase, setPhase] = useState('loading')
  const [aboutOpen, setAboutOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [webglFailed, setWebglFailed] = useState(false)

  // Where the visitor is, and how they are moving through it.
  //   scene: 'solar' | 'galaxies' | 'nebulae' | 'missions'
  //   mode (solar only): 'explore' | 'tour' | 'flight'
  const [scene, setScene] = useState('solar')
  const [mode, setMode] = useState('explore')
  const [travel, setTravel] = useState(null)

  // Solar system selection and one-shot camera requests. The nonce makes
  // repeated identical commands distinct.
  const [selectedId, setSelectedId] = useState(null)
  const [cameraCommand, setCameraCommand] = useState(null)

  // `visit` changes on every stop change; `arrived` records the last visit
  // the camera finished flying to. A stop's dwell time only runs once the
  // camera has arrived, so narration and view never drift apart.
  const [tour, setTour] = useState({ index: 0, paused: false, finished: false, visit: 0, arrived: -1 })

  const [flightSpeed, setFlightSpeed] = useState(FLIGHT_SPEED.initial)
  const [flightReset, setFlightReset] = useState(0)
  const flightInput = useRef({
    joystick: { x: 0, y: 0 },
    vertical: 0,
    speed: FLIGHT_SPEED.initial,
  })

  const [galaxyId, setGalaxyId] = useState(GALAXY_IDS[0])
  const [nebulaId, setNebulaId] = useState(NEBULA_IDS[0])
  const [blackHoleId, setBlackHoleId] = useState(BLACK_HOLE_IDS[1])
  const [blackHoleOverlay, setBlackHoleOverlay] = useState(false)
  const [diving, setDiving] = useState(false)
  const [phenomenonId, setPhenomenonId] = useState(PHENOMENON_IDS[0])
  // The Universe scene: what is selected, and which system is open around it.
  const [atlas, setAtlas] = useState({ focusId: null, systemId: null, catalogueOpen: false })
  const atlasView = useRef({ labels: null, mode: 'map' })
  // Written by the 3D scene every frame, read by the interface on its own
  // schedule, so a moving camera never re-renders the app.
  const blackHoleTelemetry = useRef({ r: null, inclination: 90, diskCrossed: false })
  const dive = useRef({ active: false, progress: 0, playing: false, r: 30 })
  // Controls for the lab's experiences, shared the same way.
  const supernova = useRef({ t: 0, playing: !reducedMotion })
  const pulsar = useRef({ speed: reducedMotion ? 0 : 1.2 })
  const wormhole = useRef({ side: 1, travelling: false, progress: 0 })
  const spacetime = useRef({ place: 'star', masses: [{ type: 'star', x: 0, z: 0 }] })
  const cosmicScale = useRef({ log: 7.2 })
  const lifecycle = useRef({ path: 'sun', stage: 0 })
  const lab = useMemo(
    () => ({ supernova, pulsar, wormhole, spacetime, scale: cosmicScale, lifecycle }),
    [],
  )
  // Explorer info panel: open by default on desktop, closed on touch layouts
  // so the scene gets the small screen first.
  const [explorerPanelOpen, setExplorerPanelOpen] = useState(() => !touch)

  const toastTimer = useRef(null)
  const phaseTimer = useRef(null)
  const travelTimers = useRef([])
  const travelBusy = useRef(false)
  const pendingAfterEnter = useRef(null)

  const webglSupported = useMemo(() => detectWebGL(), [])
  const sceneAvailable = webglSupported && !webglFailed

  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current)
      window.clearTimeout(phaseTimer.current)
      travelTimers.current.forEach((id) => window.clearTimeout(id))
    },
    [],
  )

  const sendCamera = useCallback((type, extra = {}) => {
    setCameraCommand({ type, ...extra, nonce: performance.now() })
  }, [])

  const showToast = useCallback((message) => {
    window.clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = window.setTimeout(() => setToast(null), 3200)
  }, [])

  // --- Scene travel --------------------------------------------------------
  // Fade to black, apply the change while nothing is visible, fade back.
  const travelTo = useCallback(
    (label, apply) => {
      if (travelBusy.current) return
      if (reducedMotion) {
        apply()
        return
      }
      travelBusy.current = true
      setTravel({ label })
      const timers = travelTimers.current
      timers.push(window.setTimeout(apply, TRAVEL_IN_MS))
      timers.push(window.setTimeout(() => setTravel(null), TRAVEL_IN_MS + TRAVEL_HOLD_MS))
      timers.push(
        window.setTimeout(() => {
          travelBusy.current = false
        }, TRAVEL_IN_MS + TRAVEL_HOLD_MS + TRAVEL_OUT_MS),
      )
    },
    [reducedMotion],
  )

  // --- Phases --------------------------------------------------------------
  const handleLoaderDone = useCallback(() => setPhase('landing'), [])

  // Started from the navigation (a tour or free flight from the landing
  // page): begin it now that the solar system is ready. Every route into the
  // universe ends here, the backstop timer included, so a request is never
  // dropped because the camera failed to report.
  const finishEntering = useCallback(() => {
    setPhase('universe')
    const after = pendingAfterEnter.current
    pendingAfterEnter.current = null
    after?.()
  }, [])

  const enterUniverse = useCallback(() => {
    if (phase !== 'landing') return
    setAboutOpen(false)
    setScene('solar')

    if (reducedMotion || !sceneAvailable) {
      finishEntering()
      return
    }

    setPhase('entering')
    window.clearTimeout(phaseTimer.current)
    phaseTimer.current = window.setTimeout(finishEntering, ENTER_FALLBACK)
  }, [phase, reducedMotion, sceneAvailable, finishEntering])

  const exitUniverse = useCallback(() => {
    if (phase !== 'universe') return
    setSelectedId(null)
    setMode('explore')

    if (reducedMotion || !sceneAvailable) {
      setPhase('landing')
      return
    }

    setPhase('exiting')
    window.clearTimeout(phaseTimer.current)
    phaseTimer.current = window.setTimeout(() => setPhase('landing'), EXIT_FALLBACK)
  }, [phase, reducedMotion, sceneAvailable])

  // The camera rig calls this the moment its move finishes, so the handoff
  // to OrbitControls never happens while the camera is still travelling.
  const handlePhaseSettled = useCallback(
    (settledPhase) => {
      window.clearTimeout(phaseTimer.current)
      if (settledPhase === 'entering') finishEntering()
      else if (settledPhase === 'exiting') setPhase('landing')
    },
    [finishEntering],
  )

  // Leave whatever scene we are in for the landing page.
  const exitToLanding = useCallback(() => {
    if (phase !== 'universe') return
    if (scene === 'solar') {
      exitUniverse()
      return
    }
    travelTo('Returning home', () => {
      setScene('solar')
      setMode('explore')
      setSelectedId(null)
      setPhase('landing')
    })
  }, [phase, scene, exitUniverse, travelTo])

  // --- Solar system selection ---------------------------------------------
  const clearSelection = useCallback(() => setSelectedId(null), [])

  const resetView = useCallback(() => {
    setSelectedId(null)
    sendCamera('reset')
  }, [sendCamera])

  const zoomIn = useCallback(() => sendCamera('zoom', { factor: ZOOM_STEP }), [sendCamera])
  const zoomOut = useCallback(() => sendCamera('zoom', { factor: 1 / ZOOM_STEP }), [sendCamera])

  // --- Guided tour ---------------------------------------------------------
  const goToStop = useCallback((index) => {
    setTour((t) => ({
      ...t,
      index: Math.max(0, Math.min(TOUR_STOPS.length - 1, index)),
      paused: t.finished ? false : t.paused,
      finished: false,
      visit: t.visit + 1,
    }))
  }, [])

  const beginTour = useCallback(() => {
    setSelectedId(null)
    setMode('tour')
    setTour((t) => ({ ...t, index: 0, paused: false, finished: false, visit: t.visit + 1 }))
  }, [])

  const exitTour = useCallback(() => {
    setMode('explore')
    setSelectedId(null)
    sendCamera('reset')
  }, [sendCamera])

  // Functional updates throughout: rapid clicks each advance one stop, even
  // when several arrive before React has re-rendered.
  const stepTour = useCallback((delta) => {
    setTour((t) => {
      const index = Math.max(0, Math.min(TOUR_STOPS.length - 1, t.index + delta))
      if (index === t.index) return t
      return { ...t, index, paused: t.finished ? false : t.paused, finished: false, visit: t.visit + 1 }
    })
  }, [])

  const nextStop = useCallback(() => {
    if (tour.index >= TOUR_STOPS.length - 1) exitTour()
    else stepTour(1)
  }, [tour.index, stepTour, exitTour])

  const prevStop = useCallback(() => stepTour(-1), [stepTour])

  const togglePause = useCallback(() => setTour((t) => ({ ...t, paused: !t.paused })), [])

  // Dragging the view during a tour pauses it, so the camera never moves on
  // while someone is looking around.
  const handleUserOrbit = useCallback(() => {
    setTour((t) => (t.paused ? t : { ...t, paused: true }))
  }, [])

  const handleFlightSettled = useCallback((key) => {
    setTour((t) => (t.visit === key && t.arrived !== key ? { ...t, arrived: key } : t))
  }, [])

  const tourActive = phase === 'universe' && scene === 'solar' && mode === 'tour' && !travel
  const tourArrived = tour.arrived === tour.visit

  // Backstop: if the camera never reports (no controls yet, a dropped
  // frame), start the stop anyway rather than freezing the tour.
  useEffect(() => {
    if (!tourActive || tourArrived) return
    const visit = tour.visit
    const id = window.setTimeout(() => handleFlightSettled(visit), 4000)
    return () => window.clearTimeout(id)
  }, [tourActive, tourArrived, tour.visit, handleFlightSettled])

  const tourProgress = useTourTimer({
    stepKey: `${tour.index}:${tour.visit}`,
    active: tourActive && tourArrived && !tour.finished,
    paused: tour.paused,
    duration: TOUR_DWELL_SECONDS,
    onComplete: () => {
      if (tour.index < TOUR_STOPS.length - 1) goToStop(tour.index + 1)
      else setTour((t) => ({ ...t, finished: true }))
    },
  })
  const stop = TOUR_STOPS[tour.index]

  // --- Free flight ---------------------------------------------------------
  const beginFlight = useCallback(() => {
    setSelectedId(null)
    setMode('flight')
    setFlightSpeed(flightInput.current.speed)
  }, [])

  // Free flight inside the galaxy or nebula explorer, from where you are.
  const beginExplorerFlight = useCallback(() => {
    setMode('flight')
    setFlightSpeed(flightInput.current.speed)
  }, [])

  const exitFlight = useCallback(() => {
    flightInput.current.joystick.x = 0
    flightInput.current.joystick.y = 0
    flightInput.current.vertical = 0
    setMode('explore')
  }, [])

  // --- Guided descent ------------------------------------------------------
  const beginDive = useCallback(() => {
    dive.current.active = true
    dive.current.progress = 0
    // With reduced motion nothing moves by itself: the visitor steps through.
    dive.current.playing = !reducedMotion
    setDiving(true)
  }, [reducedMotion])

  const endDive = useCallback(() => {
    if (dive.current.progress >= 1) recordDescent()
    dive.current.active = false
    dive.current.playing = false
    setDiving(false)
  }, [])

  // --- Routing between scenes and modes ------------------------------------
  // Run `after` once the solar system is on screen, travelling there first
  // if needed.
  const inSolarSystem = useCallback(
    (after) => {
      if (phase === 'landing') {
        pendingAfterEnter.current = after
        enterUniverse()
        return
      }
      if (phase !== 'universe') return
      if (scene === 'solar') {
        after()
        return
      }
      travelTo(SCENE_LABELS.solar, () => {
        setScene('solar')
        setMode('explore')
        setSelectedId(null)
        after()
      })
    },
    [phase, scene, enterUniverse, travelTo],
  )

  const goToScene = useCallback(
    (target) => {
      if (target === 'solar') {
        if (phase === 'universe' && scene === 'solar') {
          setMode('explore')
          resetView()
        } else {
          inSolarSystem(() => {})
        }
        return
      }
      if (phase === 'landing') {
        travelTo(SCENE_LABELS[target], () => {
          setScene(target)
          setMode('explore')
          setSelectedId(null)
          setPhase('universe')
        })
        return
      }
      if (phase !== 'universe' || scene === target) return
      travelTo(SCENE_LABELS[target], () => {
        setScene(target)
        setMode('explore')
        setSelectedId(null)
      })
    },
    [phase, scene, inSolarSystem, resetView, travelTo],
  )

  // From the catalogue into an object's dedicated explorer.
  const exploreObject = useCallback(
    ({ scene: target, id }) => {
      if (target === 'galaxies') setGalaxyId(id)
      else if (target === 'nebulae') setNebulaId(id)
      else if (target === 'black-holes') setBlackHoleId(id)
      goToScene(target)
    },
    [goToScene],
  )

  const handleNavigate = useCallback(
    (item) => {
      setAboutOpen(item.id === 'about')
      switch (item.id) {
        case 'home':
          exitToLanding()
          break
        case 'solar-system':
          goToScene('solar')
          break
        case 'tours':
          inSolarSystem(beginTour)
          break
        case 'flight':
          inSolarSystem(beginFlight)
          break
        case 'universe':
        case 'black-holes':
        case 'phenomena':
        case 'galaxies':
        case 'nebulae':
        case 'missions':
          goToScene(item.id)
          break
        case 'about':
          break
        default:
          showToast(`${item.label} is not built yet — planned for ${item.phase}.`)
      }
    },
    [exitToLanding, goToScene, inSolarSystem, beginTour, beginFlight, showToast],
  )

  // --- Input routed to the solar-system scene -------------------------------
  const handleSceneSelect = useCallback(
    (id) => {
      if (mode === 'flight') return
      if (mode === 'tour') {
        if (TOUR_INDEX_BY_BODY[id] != null) goToStop(TOUR_INDEX_BY_BODY[id])
        return
      }
      setSelectedId(id)
    },
    [mode, goToStop],
  )

  const handleBackgroundClick = useCallback(() => {
    if (mode === 'explore') clearSelection()
  }, [mode, clearSelection])

  // --- Keyboard ------------------------------------------------------------
  useEffect(() => {
    const onKeyDown = (event) => {
      if (phase !== 'universe' || aboutOpen || travel) return
      const target = event.target
      if (target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return

      if (event.key === 'Escape') {
        if (scene === 'universe' && atlas.catalogueOpen) setAtlas((a) => ({ ...a, catalogueOpen: false }))
        else if (scene === 'universe' && (atlas.focusId || atlas.systemId)) setAtlas((a) => ({ ...a, focusId: null, systemId: null }))
        else if (diving) endDive()
        else if (mode === 'flight') exitFlight()
        else if (scene === 'solar' && mode === 'tour') exitTour()
        else if (scene === 'solar' && selectedId) clearSelection()
        else exitToLanding()
        return
      }

      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
      if (diving) return
      // The mission archive is a page: arrows belong to its own controls.
      if (scene === 'missions') return
      // Free flight uses the arrow keys for movement.
      if (mode === 'flight') return
      const step = event.key === 'ArrowRight' ? 1 : -1

      if (scene === 'universe') return
      if (scene === 'black-holes') setBlackHoleId((id) => cycle(BLACK_HOLE_IDS, id, step))
      else if (scene === 'phenomena') setPhenomenonId((id) => cycle(PHENOMENON_IDS, id, step))
      else if (scene === 'galaxies') setGalaxyId((id) => cycle(GALAXY_IDS, id, step))
      else if (scene === 'nebulae') setNebulaId((id) => cycle(NEBULA_IDS, id, step))
      else if (mode === 'tour') (step > 0 ? nextStop : prevStop)()
      else if (mode === 'explore') {
        const index = selectedId ? BODY_ORDER.indexOf(selectedId) : step > 0 ? -1 : 0
        setSelectedId(BODY_ORDER[(index + step + BODY_ORDER.length) % BODY_ORDER.length])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, aboutOpen, travel, scene, mode, selectedId, diving, atlas, clearSelection, exitFlight, exitTour, exitToLanding, endDive, nextStop, prevStop])

  // Dedicated explorers count as discoveries too. The ids match the catalogue.
  useEffect(() => {
    if (phase !== 'universe') return
    if (scene === 'black-holes') {
      const id = blackHoleId === 'm87' ? 'm87-star' : blackHoleId
      recordVisit({ id, name: id, type: 'blackhole' })
    } else if (scene === 'solar' && selectedId) recordVisit({ id: selectedId, name: selectedId[0].toUpperCase() + selectedId.slice(1), type: selectedId === 'sun' ? 'star' : 'planet' })
  }, [phase, scene, blackHoleId, selectedId])

  // A descent belongs to the scene it started in.
  useEffect(() => {
    if (scene !== 'black-holes' && diving) endDive()
  }, [scene, diving, endDive])

  // Once in the universe, fetch the explorer scenes in the background so the
  // first visit to either is instant.
  useEffect(() => {
    if (phase !== 'universe') return
    const id = window.setTimeout(() => {
      import('./scenes/GalaxyExplorer.jsx').catch(() => {})
      import('./scenes/NebulaExplorer.jsx').catch(() => {})
      import('./scenes/BlackHoleExplorer.jsx').catch(() => {})
      import('./scenes/PhenomenaExplorer.jsx').catch(() => {})
      loadBlackHoleLayer().catch(() => {})
      loadPhenomenaHud().catch(() => {})
      loadDeepSpaceLayer().catch(() => {})
      loadAtlasLayer().catch(() => {})
      import('./scenes/AtlasExplorer.jsx').catch(() => {})
      loadMissionExplorer().catch(() => {})
    }, 3000)
    return () => window.clearTimeout(id)
  }, [phase])

  // --- Derived view state ---------------------------------------------------
  const showLanding = phase === 'landing'
  const inUniverse = phase === 'universe'

  const activeNav =
    phase === 'loading' || phase === 'landing'
      ? 'home'
      : scene === 'universe'
        ? 'universe'
        : scene === 'black-holes'
        ? 'black-holes'
        : scene === 'phenomena'
        ? 'phenomena'
        : scene === 'galaxies'
        ? 'galaxies'
        : scene === 'nebulae'
          ? 'nebulae'
          : scene === 'missions'
            ? 'missions'
            : mode === 'tour'
            ? 'tours'
            : mode === 'flight'
              ? 'flight'
              : 'solar-system'

  const sceneSelectedId = mode === 'tour' ? stop.body : mode === 'flight' ? null : selectedId

  // Shift the subject out from under whichever panel is open: sideways on
  // desktop, upwards above a bottom sheet on touch layouts.
  let viewShift = null
  if (inUniverse && !travel && mode !== 'flight') {
    if (scene === 'universe') {
      if (atlas.focusId && !atlas.systemId) viewShift = bottomSheets ? { x: 0, y: 0.2 } : { x: 0.12, y: 0 }
    } else if (scene === 'galaxies' || scene === 'nebulae' || scene === 'black-holes' || scene === 'phenomena') {
      if (explorerPanelOpen) viewShift = bottomSheets ? { x: 0, y: 0.17 } : { x: 0.13, y: 0 }
    } else if (mode === 'tour') {
      viewShift = bottomSheets ? { x: 0, y: 0.2 } : { x: -0.15, y: 0 }
    } else if (mode === 'explore' && selectedId) {
      viewShift = bottomSheets ? { x: 0, y: 0.2 } : { x: 0.12, y: 0 }
    }
  }

  // In the universe the HUD is reduced to its corner brackets: each overlay
  // owns the bottom edge, so a second strip there would collide with it.
  const readouts =
    inUniverse || !sceneAvailable
      ? []
      : [
          { label: 'Stars', value: '7,400' },
          { label: 'Layers', value: '02' },
          { label: 'Scene', value: 'DEEP FIELD' },
        ]
  const hudNote = inUniverse ? null : sceneAvailable ? 'Renderer online' : 'Static fallback'

  let hud = null
  if (inUniverse && scene === 'black-holes') {
    hud = (
      <Suspense key="black-holes" fallback={null}>
        <BlackHoleLayer
          diving={diving}
          dive={dive}
          onEndDive={endDive}
          telemetry={blackHoleTelemetry}
          onMissionComplete={(mission) => showToast(`Mission complete: ${mission.title}`)}
          reducedMotion={reducedMotion}
          flight={
            mode === 'flight'
              ? {
                  input: flightInput,
                  speed: flightSpeed,
                  onSpeedChange: setFlightSpeed,
                  onReset: () => setFlightReset((n) => n + 1),
                  onExit: exitFlight,
                  touch,
                }
              : null
          }
          hud={{
            selectedId: blackHoleId,
            onSelect: setBlackHoleId,
            onExit: exitToLanding,
            onFly: sceneAvailable ? beginExplorerFlight : undefined,
            onDive: sceneAvailable ? beginDive : undefined,
            overlay: blackHoleOverlay,
            onOverlayChange: setBlackHoleOverlay,
            panelOpen: explorerPanelOpen,
            onPanelOpenChange: setExplorerPanelOpen,
          }}
        />
      </Suspense>
    )
  } else if (inUniverse && scene === 'universe') {
    hud = (
      <Suspense key="universe" fallback={null}>
        <AtlasLayer
          atlas={atlas}
          setAtlas={setAtlas}
          view={atlasView}
          onExit={exitToLanding}
          onExplore={exploreObject}
          showToast={showToast}
          reducedMotion={reducedMotion}
        />
      </Suspense>
    )
  } else if (inUniverse && scene === 'missions') {
    hud = (
      <Suspense key="missions" fallback={<MissionsLoading />}>
        <MissionExplorer onExit={exitToLanding} reducedMotion={reducedMotion} />
      </Suspense>
    )
  } else if (inUniverse && (scene === 'galaxies' || scene === 'nebulae')) {
    hud = (
      <Suspense key={scene} fallback={null}>
        <DeepSpaceLayer
          scene={scene}
          selectedId={scene === 'galaxies' ? galaxyId : nebulaId}
          onSelect={scene === 'galaxies' ? setGalaxyId : setNebulaId}
          onExit={exitToLanding}
          onFly={beginExplorerFlight}
          panelOpen={explorerPanelOpen}
          onPanelOpenChange={setExplorerPanelOpen}
          reducedMotion={reducedMotion}
          flight={
            mode === 'flight'
              ? {
                  input: flightInput,
                  speed: flightSpeed,
                  onSpeedChange: setFlightSpeed,
                  onReset: () => setFlightReset((n) => n + 1),
                  onExit: exitFlight,
                  touch,
                }
              : null
          }
        />
      </Suspense>
    )
  } else if (inUniverse && mode === 'flight') {
    hud = (
      <FlightHud
        key="flight"
        input={flightInput}
        speed={flightSpeed}
        onSpeedChange={setFlightSpeed}
        onReset={() => setFlightReset((n) => n + 1)}
        onExit={exitFlight}
        touch={touch}
        reducedMotion={reducedMotion}
      />
    )
  } else if (inUniverse && scene === 'phenomena') {
    hud = (
      <Suspense key="phenomena" fallback={null}>
        <PhenomenaHud
          selectedId={phenomenonId}
          onSelect={setPhenomenonId}
          onExit={exitToLanding}
          panelOpen={explorerPanelOpen}
          onPanelOpenChange={setExplorerPanelOpen}
          lab={lab}
          reducedMotion={reducedMotion}
        />
      </Suspense>
    )
  } else if (inUniverse && mode === 'tour') {
    hud = (
      <TourHud
        key="tour"
        stop={stop}
        index={tour.index}
        total={TOUR_STOPS.length}
        progress={tour.finished ? 1 : tourProgress}
        paused={tour.paused}
        finished={tour.finished}
        onPrev={prevStop}
        onNext={nextStop}
        onTogglePause={togglePause}
        onExit={exitTour}
        reducedMotion={reducedMotion}
      />
    )
  } else if (inUniverse) {
    hud = (
      <UniverseHud
        key="universe-hud"
        onExit={exitToLanding}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onClearSelection={clearSelection}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onReset={resetView}
        reducedMotion={reducedMotion}
      />
    )
  }

  return (
    <main className="relative h-full w-full overflow-hidden bg-void">
      {/* One shared 3D canvas for every scene: moving between them swaps
          what is mounted inside it, never the renderer itself. */}
      {sceneAvailable ? (
        <Suspense fallback={<StaticSpaceFallback />}>
          <SceneCanvas
            phase={phase}
            scene={scene}
            mode={mode}
            reducedMotion={reducedMotion}
            onError={() => setWebglFailed(true)}
            selectedId={sceneSelectedId}
            onSelect={handleSceneSelect}
            onBackgroundClick={handleBackgroundClick}
            cameraCommand={cameraCommand}
            onPhaseSettled={handlePhaseSettled}
            focusView={mode === 'tour' ? stop.view : null}
            tourPlaying={tourActive && !tour.paused && !tour.finished}
            onUserOrbit={mode === 'tour' ? handleUserOrbit : undefined}
            flightKey={mode === 'tour' ? tour.visit : null}
            onFlightSettled={handleFlightSettled}
            flightInput={flightInput}
            flightReset={flightReset}
            onFlightSpeed={setFlightSpeed}
            galaxyId={galaxyId}
            nebulaId={nebulaId}
            phenomenonId={phenomenonId}
            lab={lab}
            atlas={atlas}
            setAtlas={setAtlas}
            atlasView={atlasView}
            blackHoleId={blackHoleId}
            blackHoleOverlay={blackHoleOverlay}
            blackHoleTelemetry={blackHoleTelemetry}
            dive={dive}
            diving={diving}
            viewShift={viewShift}
          />
        </Suspense>
      ) : (
        <StaticSpaceFallback />
      )}

      {/* Atmospheric depth over the canvas: a vignette and a cool floor glow.
          Cheap, and it keeps interface text comfortably readable. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          backgroundImage: [
            'radial-gradient(125% 100% at 50% 46%, transparent 48%, rgba(3,4,11,0.35) 82%, rgba(3,4,11,0.72) 100%)',
            'linear-gradient(to top, rgba(3,4,11,0.7) 0%, transparent 34%)',
            'linear-gradient(to bottom, rgba(3,4,11,0.5) 0%, transparent 22%)',
          ].join(','),
        }}
      />

      <AnimatePresence>
        {phase === 'loading' && (
          <Loader key="loader" onDone={handleLoaderDone} reducedMotion={reducedMotion} />
        )}
      </AnimatePresence>

      {phase !== 'loading' && (
        <>
          <Navbar onNavigate={handleNavigate} reducedMotion={reducedMotion} activeId={activeNav} />

          <HudFrame readouts={readouts} note={hudNote} />

          <AnimatePresence mode="wait">
            {showLanding && (
              <motion.div
                key="landing"
                className="absolute inset-0 z-20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, filter: reducedMotion ? 'none' : 'blur(8px)' }}
                transition={{ duration: reducedMotion ? 0 : 0.75, ease: [0.22, 1, 0.36, 1] }}
              >
                <Landing
                  onEnter={enterUniverse}
                  onBlackHole={sceneAvailable ? () => goToScene('black-holes') : undefined}
                  reducedMotion={reducedMotion}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">{hud}</AnimatePresence>

          <AnimatePresence>
            {phase === 'entering' && (
              <SystemTransition key="system-transition" duration={ENTER_DURATION} />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {aboutOpen && (
              <AboutPanel key="about" onClose={() => setAboutOpen(false)} reducedMotion={reducedMotion} />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {toast && <Toast key={toast} message={toast} reducedMotion={reducedMotion} />}
          </AnimatePresence>

          {!webglSupported && (
            <div className="pointer-events-none absolute inset-x-0 top-20 z-30 flex justify-center px-6">
              <p className="glass rounded-full px-5 py-2.5 text-[0.75rem] font-light text-ink-dim">
                WebGL is unavailable on this device — showing a static space backdrop.
              </p>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {travel && <TravelOverlay key="travel" label={travel.label} reducedMotion={reducedMotion} />}
      </AnimatePresence>
    </main>
  )
}
