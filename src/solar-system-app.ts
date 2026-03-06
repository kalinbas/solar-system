import {
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  MathUtils,
  MeshBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Raycaster,
  RingGeometry,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { BODY_CATALOG, BODY_INDEX, DATA_SNAPSHOT_DATE } from './data/catalog'
import { FlyControls } from './lib/fly-controls'
import { computeRelativePosition, getBodySpinAngle, getOrbitPeriodDays, sampleOrbitPoints } from './lib/orbits'
import { getFocusDistance, getRenderRadius, scaleDistanceKm } from './lib/scales'
import {
  clampSimulationTime,
  formatLocalDateTimeInput,
  formatLocalDateTimeLabel,
  formatTimezoneLabel,
  julianDateFromUtcMillis,
  parseLocalDateTimeInput,
  sliderValueToSpeed,
  speedToSliderValue,
} from './lib/time'
import { createBodyMaterial, createRingTexture, warmCuratedTexture } from './lib/textures'
import type { BodyCatalogEntry, CameraMode, SimulationState } from './types'

const PICKABLE_DRAG_THRESHOLD = 6

interface UiRefs {
  mount: HTMLDivElement
  dateInput: HTMLInputElement
  liveDateLabel: HTMLSpanElement
  timezoneLabel: HTMLSpanElement
  playButton: HTMLButtonElement
  speedSlider: HTMLInputElement
  speedInput: HTMLInputElement
  focusInput: HTMLInputElement
  focusButton: HTMLButtonElement
  cameraModeButton: HTMLButtonElement
  labelsCheckbox: HTMLInputElement
  orbitsCheckbox: HTMLInputElement
  nowButton: HTMLButtonElement
  selectedTitle: HTMLHeadingElement
  selectedMeta: HTMLParagraphElement
  snapshotMeta: HTMLSpanElement
}

interface BodyVisual {
  body: BodyCatalogEntry
  anchor: Group
  pivot: Group
  mesh: Mesh
  label: Sprite
  orbitLine: Line | null
  ring: Mesh | null
}

function createLabelSprite(text: string): Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Could not create label canvas.')
  }

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = 'rgba(5, 15, 28, 0.72)'
  context.roundRect(12, 18, canvas.width - 24, canvas.height - 36, 18)
  context.fill()
  context.strokeStyle = 'rgba(164, 210, 246, 0.36)'
  context.lineWidth = 3
  context.stroke()
  context.fillStyle = '#eef7ff'
  context.font = '600 42px Georgia'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, canvas.width / 2, canvas.height / 2)

  const texture = new CanvasTexture(canvas)
  texture.needsUpdate = true
  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  })

  const sprite = new Sprite(material)
  sprite.scale.set(1.8, 0.45, 1)
  sprite.renderOrder = 10
  return sprite
}

function createStars(): Points {
  const starCount = 7000
  const positions = new Float32Array(starCount * 3)
  for (let index = 0; index < starCount; index += 1) {
    const radius = 7000 + Math.random() * 25000
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta)
    positions[index * 3 + 1] = radius * Math.cos(phi)
    positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  const material = new PointsMaterial({
    color: new Color('#d8e9ff'),
    size: 6,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.92,
  })
  return new Points(geometry, material)
}

function describeBody(body: BodyCatalogEntry): string {
  const period = getOrbitPeriodDays(body)
  const orbitText = period ? `${period.toFixed(period > 30 ? 1 : 3)} days/orbit` : 'No orbit'
  return `${body.kind.toUpperCase()} • ${body.system.toUpperCase()} • radius ${body.radiiKm.mean.toLocaleString()} km • ${orbitText}`
}

export class SolarSystemApp {
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(50, 1, 0.001, 120_000)
  private readonly renderer = new WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true })
  private readonly controls: OrbitControls
  private readonly flyControls: FlyControls
  private readonly sphereGeometry = new SphereGeometry(1, 32, 24)
  private readonly bodyVisuals = new Map<string, BodyVisual>()
  private readonly pickTargets: Mesh[] = []
  private readonly pickTargetIndex = new Map<string, string>()
  private readonly raycaster = new Raycaster()
  private readonly pointer = new Vector2()
  private readonly bodyNames = new Map(BODY_CATALOG.map((body) => [body.name.toLowerCase(), body.id]))
  private readonly selectedWorldPosition = new Vector3()

  private state: SimulationState = {
    instantUtcMs: clampSimulationTime(Date.now()),
    isPlaying: false,
    speedDaysPerSecond: 1,
    selectedBodyId: 'sun',
    cameraMode: 'focus-orbit',
    showLabels: true,
    showOrbits: true,
  }

  private lastFrameTime = performance.now()
  private lastOrbitRefreshJulianDate = Number.NaN
  private clickStart: { x: number; y: number } | null = null

  constructor(private readonly ui: UiRefs) {
    this.scene.background = new Color('#020812')
    this.scene.add(new AmbientLight('#6d7683', 1.25))
    this.scene.add(createStars())

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.ui.mount.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.enablePan = true
    this.controls.maxDistance = 60_000
    this.controls.minDistance = 0.02

    this.flyControls = new FlyControls(this.camera, this.renderer.domElement)

    this.camera.position.set(0, 180, 320)
    this.buildScene()
    this.bindUi()
    this.updateResize()
    this.refreshUi()
    this.focusBody('sun', true)
    this.setCameraMode('focus-orbit')

    window.addEventListener('resize', this.updateResize)
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown)
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerUp)

    this.renderer.setAnimationLoop(this.animate)
  }

  dispose(): void {
    window.removeEventListener('resize', this.updateResize)
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown)
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerUp)
    this.controls.dispose()
    this.flyControls.dispose()
    this.renderer.dispose()
  }

  private buildScene(): void {
    for (const body of BODY_CATALOG) {
      const anchor = new Group()
      anchor.name = `${body.id}-anchor`
      const parentAnchor = body.parentId ? this.bodyVisuals.get(body.parentId)?.anchor : this.scene
      parentAnchor?.add(anchor)

      const pivot = new Group()
      pivot.rotation.z = MathUtils.degToRad(body.rotationModel.axialTiltDeg)
      anchor.add(pivot)

      const material = createBodyMaterial(body)
      const mesh = new Mesh(this.sphereGeometry, material)
      mesh.name = body.id
      const radius = getRenderRadius(body)
      mesh.scale.setScalar(radius)
      pivot.add(mesh)

      const label = createLabelSprite(body.name)
      label.position.set(0, radius * 1.8 + 0.04, 0)
      pivot.add(label)

      let ring: Mesh | null = null
      if (body.ringSet) {
        const ringGeometry = new RingGeometry(
          scaleDistanceKm(body.ringSet.innerRadiusKm),
          scaleDistanceKm(body.ringSet.outerRadiusKm),
          96,
        )
        const ringMaterial = new MeshBasicMaterial({
          map: createRingTexture(body.ringSet.textureFamily),
          side: DoubleSide,
          transparent: true,
          depthWrite: false,
        })
        const ringMesh = new Mesh(ringGeometry, ringMaterial)
        ringMesh.rotation.x = Math.PI / 2
        ringMesh.renderOrder = 1
        pivot.add(ringMesh)
        ring = ringMesh
      }

      const orbitLine = body.orbitModel
        ? new Line(
            new BufferGeometry(),
            new LineBasicMaterial({
              color: body.kind === 'planet' ? '#5378d1' : '#7ca7d9',
              transparent: true,
              opacity: body.kind === 'planet' ? 0.38 : 0.22,
            }),
          )
        : null

      if (orbitLine) {
        orbitLine.name = `${body.id}-orbit`
        orbitLine.visible = false
        const orbitParent = body.parentId ? this.bodyVisuals.get(body.parentId)?.anchor : this.scene
        orbitParent?.add(orbitLine)
      }

      warmCuratedTexture(body, (texture) => {
        const targetMaterial = mesh.material as MeshBasicMaterial | MeshStandardMaterial
        targetMaterial.map = texture
        targetMaterial.needsUpdate = true
      })

      this.bodyVisuals.set(body.id, { body, anchor, pivot, mesh, label, orbitLine, ring })
      this.pickTargets.push(mesh)
      this.pickTargetIndex.set(mesh.uuid, body.id)
    }
  }

  private bindUi(): void {
    this.ui.snapshotMeta.textContent = DATA_SNAPSHOT_DATE.slice(0, 10)
    this.ui.timezoneLabel.textContent = formatTimezoneLabel()
    this.ui.dateInput.value = formatLocalDateTimeInput(this.state.instantUtcMs)
    this.ui.speedSlider.value = speedToSliderValue(this.state.speedDaysPerSecond).toFixed(2)
    this.ui.speedInput.value = this.state.speedDaysPerSecond.toFixed(2)

    this.ui.dateInput.addEventListener('change', () => {
      const parsed = parseLocalDateTimeInput(this.ui.dateInput.value)
      if (parsed !== null) {
        this.state.instantUtcMs = parsed
        this.refreshScene(true)
      }
    })

    this.ui.playButton.addEventListener('click', () => {
      this.state.isPlaying = !this.state.isPlaying
      this.refreshUi()
    })

    this.ui.speedSlider.addEventListener('input', () => {
      const speed = sliderValueToSpeed(Number.parseFloat(this.ui.speedSlider.value))
      this.state.speedDaysPerSecond = speed
      this.ui.speedInput.value = speed.toFixed(2)
    })

    this.ui.speedInput.addEventListener('change', () => {
      const parsed = Number.parseFloat(this.ui.speedInput.value)
      if (Number.isFinite(parsed) && parsed > 0) {
        this.state.speedDaysPerSecond = parsed
        this.ui.speedSlider.value = speedToSliderValue(parsed).toFixed(2)
      }
    })

    this.ui.focusButton.addEventListener('click', () => {
      const requested = this.bodyNames.get(this.ui.focusInput.value.trim().toLowerCase())
      if (requested) {
        this.focusBody(requested, true)
      }
    })

    this.ui.focusInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return
      }

      const requested = this.bodyNames.get(this.ui.focusInput.value.trim().toLowerCase())
      if (requested) {
        this.focusBody(requested, true)
      }
    })

    this.ui.cameraModeButton.addEventListener('click', () => {
      this.setCameraMode(this.state.cameraMode === 'focus-orbit' ? 'free-fly' : 'focus-orbit')
    })

    this.ui.labelsCheckbox.addEventListener('change', () => {
      this.state.showLabels = this.ui.labelsCheckbox.checked
      this.refreshVisibility()
    })

    this.ui.orbitsCheckbox.addEventListener('change', () => {
      this.state.showOrbits = this.ui.orbitsCheckbox.checked
      this.refreshVisibility()
    })

    this.ui.nowButton.addEventListener('click', () => {
      this.state.instantUtcMs = clampSimulationTime(Date.now())
      this.refreshScene(true)
    })
  }

  private readonly updateResize = (): void => {
    const { clientWidth, clientHeight } = this.ui.mount
    this.camera.aspect = Math.max(clientWidth, 1) / Math.max(clientHeight, 1)
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(clientWidth, clientHeight, false)
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.clickStart = { x: event.clientX, y: event.clientY }
  }

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (!this.clickStart || this.state.cameraMode !== 'focus-orbit') {
      return
    }

    const distance = Math.hypot(event.clientX - this.clickStart.x, event.clientY - this.clickStart.y)
    this.clickStart = null
    if (distance > PICKABLE_DRAG_THRESHOLD) {
      return
    }

    const bounds = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
    this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const intersections = this.raycaster.intersectObjects(this.pickTargets, false)
    const topHit = intersections[0]
    if (!topHit) {
      return
    }

    const bodyId = this.pickTargetIndex.get(topHit.object.uuid)
    if (bodyId) {
      this.focusBody(bodyId, true)
    }
  }

  private setCameraMode(mode: CameraMode): void {
    this.state.cameraMode = mode
    const orbitMode = mode === 'focus-orbit'
    this.controls.enabled = orbitMode
    this.flyControls.setEnabled(!orbitMode)
    if (orbitMode) {
      this.focusBody(this.state.selectedBodyId, false)
    }
    this.refreshUi()
  }

  private focusBody(bodyId: string, repositionCamera: boolean): void {
    const body = BODY_INDEX.get(bodyId)
    const visual = this.bodyVisuals.get(bodyId)
    if (!body || !visual) {
      return
    }

    this.state.selectedBodyId = bodyId
    this.refreshScene(false)

    visual.anchor.getWorldPosition(this.selectedWorldPosition)
    this.controls.target.copy(this.selectedWorldPosition)

    if (repositionCamera) {
      const distance = getFocusDistance(body)
      const offset = new Vector3(distance * 0.9, distance * 0.42, distance * 1.1)
      this.camera.position.copy(this.selectedWorldPosition.clone().add(offset))
    }

    this.ui.focusInput.value = body.name
    this.ui.selectedTitle.textContent = body.name
    this.ui.selectedMeta.textContent = describeBody(body)
    this.refreshVisibility()
    this.refreshUi()
  }

  private refreshUi(): void {
    this.ui.liveDateLabel.textContent = formatLocalDateTimeLabel(this.state.instantUtcMs)
    this.ui.playButton.textContent = this.state.isPlaying ? 'Pause' : 'Play'
    this.ui.cameraModeButton.textContent = this.state.cameraMode === 'focus-orbit' ? 'Switch To Fly' : 'Switch To Orbit'
    this.ui.labelsCheckbox.checked = this.state.showLabels
    this.ui.orbitsCheckbox.checked = this.state.showOrbits
    if (document.activeElement !== this.ui.dateInput) {
      this.ui.dateInput.value = formatLocalDateTimeInput(this.state.instantUtcMs)
    }
  }

  private refreshOrbitLines(julianDate: number): void {
    for (const visual of this.bodyVisuals.values()) {
      if (!visual.orbitLine) {
        continue
      }

      const samples = visual.body.kind === 'planet' ? 220 : 120
      const points = sampleOrbitPoints(visual.body, julianDate, samples).map((point) => point.multiplyScalar(scaleDistanceKm(1)))
      visual.orbitLine.geometry.setFromPoints(points)
    }
    this.lastOrbitRefreshJulianDate = julianDate
  }

  private refreshVisibility(): void {
    const selected = BODY_INDEX.get(this.state.selectedBodyId) ?? BODY_INDEX.get('sun')
    const activeSystem = selected?.kind === 'moon' ? selected.system : selected?.id ?? 'sun'

    for (const visual of this.bodyVisuals.values()) {
      visual.label.visible =
        this.state.showLabels &&
        (visual.body.kind === 'sun' ||
          visual.body.kind === 'planet' ||
          visual.body.system === activeSystem ||
          visual.body.id === this.state.selectedBodyId)

      if (visual.orbitLine) {
        visual.orbitLine.visible =
          this.state.showOrbits &&
          (visual.body.kind === 'planet' ||
            activeSystem === visual.body.system ||
            this.state.selectedBodyId === 'sun')
      }
    }
  }

  private refreshScene(forceOrbitRefresh: boolean): void {
    const julianDate = julianDateFromUtcMillis(this.state.instantUtcMs)

    for (const visual of this.bodyVisuals.values()) {
      const relativePosition = computeRelativePosition(visual.body, julianDate)
      visual.anchor.position.set(
        scaleDistanceKm(relativePosition.x),
        scaleDistanceKm(relativePosition.y),
        scaleDistanceKm(relativePosition.z),
      )
      visual.mesh.rotation.y = getBodySpinAngle(visual.body, julianDate)
    }

    if (forceOrbitRefresh || !Number.isFinite(this.lastOrbitRefreshJulianDate) || Math.abs(julianDate - this.lastOrbitRefreshJulianDate) > 15) {
      this.refreshOrbitLines(julianDate)
    }

    const selectedVisual = this.bodyVisuals.get(this.state.selectedBodyId)
    if (selectedVisual && this.state.cameraMode === 'focus-orbit') {
      const previous = this.selectedWorldPosition.clone()
      selectedVisual.anchor.getWorldPosition(this.selectedWorldPosition)
      const delta = this.selectedWorldPosition.clone().sub(previous)
      this.camera.position.add(delta)
      this.controls.target.copy(this.selectedWorldPosition)
    }

    this.refreshVisibility()
    this.refreshUi()
  }

  private readonly animate = (): void => {
    const now = performance.now()
    const deltaSeconds = Math.min((now - this.lastFrameTime) / 1000, 0.1)
    this.lastFrameTime = now

    if (this.state.isPlaying) {
      const deltaMillis = deltaSeconds * this.state.speedDaysPerSecond * 86_400_000
      this.state.instantUtcMs = clampSimulationTime(this.state.instantUtcMs + deltaMillis)
      this.refreshScene(false)
    }

    if (this.state.cameraMode === 'free-fly') {
      this.flyControls.setSpeed(Math.max(15, this.camera.position.length() * 0.08))
      this.flyControls.update(deltaSeconds)
    } else {
      this.controls.update()
    }

    this.renderer.render(this.scene, this.camera)
  }
}
