import * as THREE from 'three'

/**
 * A MeshStandardMaterial with the few things a planet needs that the stock
 * material cannot do, patched in rather than written from scratch so it keeps
 * Three's physically based lighting, tone mapping and colour management:
 *
 *  - night lights that only show on the side facing away from the Sun;
 *  - cloud shadows: the cloud layer's own map sampled at its current
 *    rotation, darkening the ground beneath it;
 *  - ring shadows: the line to the Sun intersected with the ring plane and
 *    the ring's opacity looked up where it crosses (Saturn's banded shadow);
 *  - atmospheric haze: a Fresnel tint on the day side and a warm band along
 *    the terminator, the cheap stand-in for real scattering.
 *
 * The Sun is at the world origin in the solar system, so the light direction
 * is just the negated world position: nothing to update per frame except
 * the cloud layer's rotation.
 */
export function createPlanetMaterial({
  map,
  data = null,
  bumpScale = 1,
  roughness = 0.92,
  night = 0,
  clouds = null,
  cloudShadow = 0,
  ring = null,
  atmosphere = null,
  occluders = false,
  occluderTint = '#000000',
}) {
  const material = new THREE.MeshStandardMaterial({
    map,
    bumpMap: data,
    bumpScale,
    roughnessMap: data,
    roughness: data ? 1 : roughness,
    metalness: 0,
  })

  const defines = {}
  if (night > 0 && data) defines.PLANET_NIGHT = ''
  if (clouds && cloudShadow > 0) defines.PLANET_CLOUD_SHADOW = ''
  if (ring) defines.PLANET_RING_SHADOW = ''
  if (atmosphere) defines.PLANET_ATMO = ''
  if (occluders) defines.PLANET_OCCLUDERS = ''
  material.defines = defines

  const uniforms = {
    uDataMap: { value: data },
    uNight: { value: night },
    uCloudMap: { value: clouds },
    uCloudShift: { value: 0 },
    uCloudShadow: { value: cloudShadow },
    uRingMap: { value: ring?.texture ?? null },
    uRing: { value: new THREE.Vector3(ring?.inner ?? 0, ring?.outer ?? 1, ring?.strength ?? 0.85) },
    uAtmo: { value: new THREE.Color(atmosphere?.color ?? '#000000') },
    uTwilight: { value: new THREE.Color(atmosphere?.twilight ?? '#000000') },
    uAtmoStrength: { value: atmosphere?.strength ?? 0 },
    // Up to four bodies that can eclipse this one: centre and radius, and a
    // strength (0 = no eclipse now). Set from the frame loop, only while the
    // real geometry says an eclipse is happening.
    uOcc: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
    uOccStrength: { value: [0, 0, 0, 0] },
    uOccTint: { value: new THREE.Color(occluderTint) },
    // Where the Sun is: a point (w = 0, the world origin by default, as in the
    // solar system) or a fixed direction (w = 1, the open universe, where the
    // render origin is the camera).
    uSun: { value: new THREE.Vector4(0, 0, 0, 0) },
  }
  material.userData.uniforms = uniforms

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vPWorld;
         varying vec3 vPNormal;
         varying vec3 vPCenter;
         varying vec3 vPAxis;
         varying float vPScale;`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
         vPWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
         vPNormal = normalize(mat3(modelMatrix) * objectNormal);
         vPCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
         vPAxis = normalize((modelMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
         vPScale = length((modelMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform sampler2D uDataMap;
         uniform float uNight;
         uniform sampler2D uCloudMap;
         uniform float uCloudShift;
         uniform float uCloudShadow;
         uniform sampler2D uRingMap;
         uniform vec3 uRing;
         uniform vec3 uAtmo;
         uniform vec3 uTwilight;
         uniform float uAtmoStrength;
         uniform vec4 uOcc[4];
         uniform float uOccStrength[4];
         uniform vec3 uOccTint;
         uniform vec4 uSun;
         varying vec3 vPWorld;
         varying vec3 vPNormal;
         varying vec3 vPCenter;
         varying vec3 vPAxis;
         varying float vPScale;
         vec3 planetSunDir() {
           return uSun.w > 0.5 ? uSun.xyz : normalize(uSun.xyz - vPWorld);
         }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         #ifdef PLANET_NIGHT
           float cityLight = texture2D(uDataMap, vMapUv).b;
           float sunFacing = dot(normalize(vPNormal), planetSunDir());
           float darkSide = 1.0 - smoothstep(-0.2, 0.06, sunFacing);
           #ifdef PLANET_CLOUD_SHADOW
             cityLight *= 1.0 - 0.7 * texture2D(uCloudMap, vec2(vMapUv.x - uCloudShift, vMapUv.y)).a;
           #endif
           totalEmissiveRadiance += vec3(1.0, 0.7, 0.36) * cityLight * darkSide * uNight;
         #endif`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
         float planetShade = 1.0;
         #ifdef PLANET_CLOUD_SHADOW
           planetShade *= 1.0 - uCloudShadow * texture2D(uCloudMap, vec2(vMapUv.x - uCloudShift, vMapUv.y)).a;
         #endif
         #ifdef PLANET_RING_SHADOW
           {
             vec3 toSun = planetSunDir();
             float facing = dot(toSun, vPAxis);
             if (abs(facing) > 1e-4) {
               float t = dot(vPCenter - vPWorld, vPAxis) / facing;
               if (t > 0.0) {
                 float r = length(vPWorld + toSun * t - vPCenter) / vPScale;
                 float u = (r - uRing.x) / (uRing.y - uRing.x);
                 if (u > 0.0 && u < 1.0) planetShade *= 1.0 - texture2D(uRingMap, vec2(u, 0.5)).a * uRing.z;
               }
             }
           }
         #endif
         vec3 eclipseTint = vec3(1.0);
         #ifdef PLANET_OCCLUDERS
           {
             vec3 toSun = planetSunDir();
             for (int k = 0; k < 4; k++) {
               if (uOccStrength[k] <= 0.0) continue;
               vec3 toBody = uOcc[k].xyz - vPWorld;
               float along = dot(toBody, toSun);
               if (along <= 0.0) continue;
               float miss = length(toBody - toSun * along);
               // Umbra inside, a soft penumbra out to twice the radius.
               float lit = smoothstep(uOcc[k].w * 0.55, uOcc[k].w * 1.6, miss);
               eclipseTint *= mix(uOccTint, vec3(1.0), 1.0 - (1.0 - lit) * uOccStrength[k]);
             }
           }
         #endif
         reflectedLight.directDiffuse *= planetShade * eclipseTint;
         reflectedLight.directSpecular *= planetShade * eclipseTint;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `#ifdef PLANET_ATMO
           {
             vec3 n = normalize(vPNormal);
             vec3 v = normalize(cameraPosition - vPWorld);
             float sunFacing = dot(n, planetSunDir());
             float fresnel = pow(1.0 - max(dot(n, v), 0.0), 2.4);
             float day = smoothstep(-0.12, 0.4, sunFacing);
             float twilight = exp(-pow(sunFacing / 0.09, 2.0));
             outgoingLight += (uAtmo * day * (0.18 + fresnel) + uTwilight * twilight * (0.03 + fresnel * 0.5)) * uAtmoStrength;
           }
         #endif
         #include <opaque_fragment>`,
      )
  }
  material.customProgramCacheKey = () => `planet:${Object.keys(defines).sort().join(',')}`
  return material
}

/** Planet materials by body id, so eclipses can reach them from elsewhere. */
export const planetMaterials = new Map()
