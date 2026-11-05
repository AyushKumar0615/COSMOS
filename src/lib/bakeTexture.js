import * as THREE from 'three'

/**
 * Everything baked for each renderer, so it can be redrawn. A render target's
 * pixels exist only on the GPU: when the browser drops the WebGL context
 * (common on phones when a tab is backgrounded) they are gone, and unlike an
 * image there is no source for Three.js to upload again.
 */
const bakes = new WeakMap()

function draw(renderer, target, material) {
  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  scene.add(quad)

  // Clear to fully transparent. The renderer's own clear colour is the
  // opaque scene background; leaving it in place would give every baked
  // texture an alpha of 1, turning the cloud map into a solid shell.
  const previousTarget = renderer.getRenderTarget()
  const previousClearColor = new THREE.Color()
  renderer.getClearColor(previousClearColor)
  const previousClearAlpha = renderer.getClearAlpha()

  renderer.setClearColor(0x000000, 0)
  renderer.setRenderTarget(target)
  renderer.render(scene, camera)
  renderer.setRenderTarget(previousTarget)
  renderer.setClearColor(previousClearColor, previousClearAlpha)

  quad.geometry.dispose()
  material.dispose()
}

function remember(renderer, target, material) {
  let list = bakes.get(renderer)
  if (!list) {
    list = []
    bakes.set(renderer, list)
    // Registered after the renderer's own listener, so Three.js has already
    // rebuilt its GL state by the time this runs. The targets keep their
    // texture objects, so every material using them recovers untouched.
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      for (const bake of list) draw(renderer, bake.target, bake.material)
    })
  }
  list.push({ target, material })
}

/**
 * Free a baked texture for good, including its record for context restore.
 * Long-lived caches use this: a bake that is merely dropped stays on the GPU.
 */
export function releaseBake(renderer, texture) {
  const list = bakes.get(renderer)
  const index = list?.findIndex((bake) => bake.target.texture === texture) ?? -1
  if (index < 0) return
  const [bake] = list.splice(index, 1)
  bake.target.dispose()
  bake.material.dispose()
}

/**
 * Render a full-screen shader quad once into a texture. Shared by the
 * planet surfaces and the nebula cloud noise: procedural detail is paid for
 * once at load, and the frame loop only ever samples flat textures.
 *
 * colorSpace: SRGB for colour maps, NoColorSpace for data (noise) textures.
 */
export function renderToTexture(
  renderer,
  width,
  height,
  material,
  { colorSpace = THREE.SRGBColorSpace, wrap = THREE.RepeatWrapping } = {},
) {
  // Written verbatim into the target. Without this the quad would blend
  // against the clear colour and the result would be premultiplied.
  material.blending = THREE.NoBlending

  const target = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: true,
    depthBuffer: false,
    stencilBuffer: false,
  })
  target.texture.colorSpace = colorSpace
  target.texture.wrapS = wrap
  target.texture.wrapT = THREE.ClampToEdgeWrapping
  target.texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())

  draw(renderer, target, material)
  remember(renderer, target, material)

  return target.texture
}
