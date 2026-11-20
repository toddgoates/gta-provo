export const FIXED_DT = 1 / 60;

export class GameLoop {
  private frame = 0;
  private lastTime: number | null = null;
  private accumulator = 0;

  constructor(
    private readonly advance: (dt: number) => void,
    private readonly render: (dt: number, alpha: number) => void,
    private readonly shouldAdvance: () => boolean,
  ) {}

  start(): void {
    if (!this.frame) this.frame = requestAnimationFrame(this.tick);
  }

  stop(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.lastTime = null;
    this.accumulator = 0;
  }

  private tick = (now: number): void => {
    this.frame = requestAnimationFrame(this.tick);
    const elapsed = this.lastTime === null ? 0 : Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    if (this.shouldAdvance()) {
      this.accumulator += elapsed;
      while (this.accumulator >= FIXED_DT && this.shouldAdvance()) {
        this.accumulator -= FIXED_DT;
        this.advance(FIXED_DT);
      }
    }
    if (!this.shouldAdvance()) this.accumulator = 0;
    this.render(elapsed, this.shouldAdvance() ? this.accumulator / FIXED_DT : 1);
  };
}
