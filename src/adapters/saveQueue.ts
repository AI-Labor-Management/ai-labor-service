/** Serialize asynchronous persistence and retain the latest snapshot after a failure. */
export class SaveQueue<T> {
  private latest: T | undefined;
  private pending = false;
  private running: Promise<void> | null = null;
  private failed = false;
  constructor(
    private save: (state: T) => Promise<void>,
    private report: (busy: boolean, error: unknown | null) => void,
  ) {}
  enqueue(value: T) {
    this.latest = value;
    this.pending = true;
    if (!this.failed) this.start();
  }
  retry() {
    this.failed = false;
    if (this.latest !== undefined) this.pending = true;
    this.start();
  }
  private start() {
    if (this.running || !this.pending) return;
    this.running = this.drain().finally(() => {
      this.running = null;
      if (this.pending && !this.failed) this.start();
    });
  }
  private async drain() {
    this.report(true, null);
    while (this.pending && !this.failed) {
      const value = this.latest!;
      this.pending = false;
      try {
        await this.save(value);
      } catch (e) {
        this.pending = true;
        this.failed = true;
        this.report(false, e);
        return;
      }
    }
    this.report(false, null);
  }
  async flush() {
    while (this.running) await this.running;
  }
}
