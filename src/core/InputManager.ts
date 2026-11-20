const heldKeys = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight", "Space"]);
const actions = new Set(["Space", "KeyE"]);

export class InputManager {
  private held = new Set<string>();
  private pressed = new Set<string>();
  private cleanup = new AbortController();
  private dx = 0;
  private dy = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly canLook: () => boolean,
    onPause: () => void,
    onBlur: () => void,
    onDebug?: () => void,
  ) {
    const options = { signal: this.cleanup.signal };
    window.addEventListener("keydown", (event) => {
      if (event.code === "F1" && onDebug) {
        event.preventDefault();
        if (!event.repeat) onDebug();
        return;
      }
      if (event.code === "Escape") {
        if (!event.repeat && document.pointerLockElement !== canvas) onPause();
        return;
      }
      if (event.target instanceof HTMLElement && event.target.closest("button, input, textarea, select")) return;
      if (!this.canLook()) return;
      if (heldKeys.has(event.code)) {
        event.preventDefault();
        this.held.add(event.code);
      }
      if (actions.has(event.code)) {
        event.preventDefault();
        if (!event.repeat) this.pressed.add(event.code);
      }
    }, options);
    window.addEventListener("keyup", (event) => this.held.delete(event.code), options);
    window.addEventListener("blur", () => { this.clear(); onBlur(); }, options);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { this.clear(); onBlur(); }
    }, options);
    let wasLocked = false;
    document.addEventListener("pointerlockchange", () => {
      const locked = document.pointerLockElement === canvas;
      if (wasLocked && !locked && this.canLook()) onPause();
      wasLocked = locked;
    }, options);
    canvas.addEventListener("click", () => {
      if (this.canLook() && document.pointerLockElement !== canvas) {
        const lock = canvas.requestPointerLock?.();
        lock?.catch(() => { /* Drag-look remains available when lock is denied. */ });
      }
    }, options);
    window.addEventListener("mousemove", (event) => {
      if (!this.canLook()) return;
      if (document.pointerLockElement === canvas || ((event.buttons & 1) !== 0 && event.target === canvas)) {
        this.dx += event.movementX;
        this.dy += event.movementY;
      }
    }, options);
  }

  down(code: string): boolean { return this.held.has(code); }
  take(code: string): boolean { return this.pressed.delete(code); }
  takeLook(): [number, number] {
    const delta: [number, number] = [this.dx, this.dy];
    this.dx = this.dy = 0;
    return delta;
  }
  clear(): void {
    this.held.clear();
    this.pressed.clear();
    this.dx = this.dy = 0;
  }
  unlock(): void {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }
  dispose(): void {
    this.cleanup.abort();
    this.clear();
    this.unlock();
  }
}
