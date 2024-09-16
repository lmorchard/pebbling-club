export default class BatchQueue {
  constructor({
    onBatch = async (batch) => {},
    onError = async (error) => {},
    batchSize = 5,
    runDelay = 100,
  }) {
    this.onBatch = onBatch;
    this.onError = onError;
    this.batchSize = batchSize;
    this.isRunning = false;
    this.runDelay = runDelay;
    this.runDelayTimer = null;
    this.jobs = [];
  }

  push(job) {
    this.jobs.push(job);
    this.maybeRunBatch();
  }

  maybeRunBatch() {
    if (this.jobs.length === 0) return;
    if (this.isRunning) return;
    if (this.runDelayTimer) clearTimeout(this.runDelayTimer);
    this.runDelayTimer = setTimeout(() => this.runBatch(), this.runDelay);
  }

  async runBatch() {
    if (this.running) return;
    this.running = true;
    try {
      const batch = this.jobs.splice(0, this.batchSize);
      await this.onBatch(batch);
    } catch (err) {
      await this.onError(err);
    }
    this.running = false;
    this.maybeRunBatch();
  }
}
