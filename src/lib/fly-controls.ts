import { Euler, PerspectiveCamera, Vector3 } from 'three'

export class FlyControls {
  private readonly euler = new Euler(0, 0, 0, 'YXZ')
  private readonly keys = new Set<string>()
  private enabled = false
  private dragging = false
  private speed = 35

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly domElement: HTMLElement,
  ) {
    this.syncEulerFromCamera()
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    this.domElement.addEventListener('pointerdown', this.handlePointerDown)
    window.addEventListener('pointerup', this.handlePointerUp)
    window.addEventListener('pointermove', this.handlePointerMove)
    this.domElement.addEventListener('wheel', this.handleWheel, { passive: true })
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    this.dragging = false
    this.syncEulerFromCamera()
    this.domElement.style.cursor = enabled ? 'grab' : 'default'
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(4, speed)
  }

  update(deltaSeconds: number): void {
    if (!this.enabled) {
      return
    }

    const movement = new Vector3(
      Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')),
      Number(this.keys.has('KeyE')) - Number(this.keys.has('KeyQ')),
      Number(this.keys.has('KeyS')) - Number(this.keys.has('KeyW')),
    )

    if (movement.lengthSq() === 0) {
      return
    }

    movement.normalize()
    const boost = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 6 : 1
    movement.multiplyScalar(this.speed * boost * deltaSeconds)
    movement.applyEuler(this.euler)
    this.camera.position.add(movement)
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    this.domElement.removeEventListener('pointerdown', this.handlePointerDown)
    window.removeEventListener('pointerup', this.handlePointerUp)
    window.removeEventListener('pointermove', this.handlePointerMove)
    this.domElement.removeEventListener('wheel', this.handleWheel)
  }

  private syncEulerFromCamera(): void {
    this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ')
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code)
  }

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code)
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.enabled || event.button !== 0) {
      return
    }

    this.dragging = true
    this.domElement.style.cursor = 'grabbing'
  }

  private readonly handlePointerUp = (): void => {
    if (!this.enabled) {
      return
    }

    this.dragging = false
    this.domElement.style.cursor = 'grab'
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.enabled || !this.dragging) {
      return
    }

    this.euler.y -= event.movementX * 0.0022
    this.euler.x -= event.movementY * 0.0022
    this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x))
    this.camera.quaternion.setFromEuler(this.euler)
  }

  private readonly handleWheel = (event: WheelEvent): void => {
    if (!this.enabled) {
      return
    }

    this.speed = Math.max(4, this.speed * (event.deltaY > 0 ? 0.9 : 1.1))
  }
}
