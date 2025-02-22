export default class BatchQueue<JobItem extends {}> {
  onBatch: OnBatchHandler<JobItem>;
  onError?: OnErrorHandler;

  batchSize: number;
  isRunning: boolean;
  runDelay: number;
  runDelayTimer: null | NodeJS.Timeout;
  jobs: JobItem[];

  constructor({
    onBatch,
    onError,
    batchSize = 5,
    runDelay = 100,
  }: {
    onBatch: OnBatchHandler<JobItem>;
    onError?: OnErrorHandler;
    batchSize?: number;
    runDelay?: number;
  }) {
    this.onBatch = onBatch;
    this.onError = onError;
    this.batchSize = batchSize;
    this.isRunning = false;
    this.runDelay = runDelay;
    this.runDelayTimer = null;
    this.jobs = [];
  }

  push(job: JobItem) {
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
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const batch = this.jobs.splice(0, this.batchSize);
      await this.onBatch(batch);
    } catch (err) {
      this.onError && (await this.onError(err));
    }
    this.isRunning = false;
    this.maybeRunBatch();
  }
}

type OnBatchHandler<JobItem extends {}> = (batch: JobItem[]) => Promise<void>;

type OnErrorHandler = (error: any) => Promise<void>;
