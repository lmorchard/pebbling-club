import PQueue from "p-queue";
import { JobsService } from ".";
import { JobPayload, JobResult, JobHandler, JobModel } from "./types";

export class JobsServiceQueue {
  parent: JobsService;
  queue = new PQueue({
    concurrency: 1,
    autoStart: false,
    throwOnTimeout: true,
    // TODO: make this configurable - also per job?
    timeout: 1000 * 60 * 5,
  });
  handlers = new Map<string, JobHandler>();
  jobsPollIntervalTimer: NodeJS.Timeout | null = null;

  constructor(parent: JobsService) {
    this.parent = parent;
  }

  async init() {
    const { config } = this.parent.app;
    this.queue.concurrency = config.get("jobsQueueConcurrency");
  }

  async deinit() {
    await this.pause();
  }

  async start() {
    const { log, app } = this.parent;
    const { config } = app;

    log.debug({ msg: "starting jobs queue" });

    this.queue.start();

    if (this.jobsPollIntervalTimer) {
      clearInterval(this.jobsPollIntervalTimer);
    }
    this.jobsPollIntervalTimer = setInterval(
      () => this.maybeFillQueue(),
      config.get("jobsPollIntervalPeriod")
    );

    await this.maybeFillQueue();
  }

  async pause() {
    this.queue.pause();
    if (this.jobsPollIntervalTimer) {
      clearInterval(this.jobsPollIntervalTimer);
    }
  }

  async onIdle() {
    return this.queue.onIdle();
  }

  async isIdle() {
    return await this.totalCount() === 0;
  }

  async count() {
    return this.queue.size;
  }

  async pendingCount() {
    return this.queue.pending;
  }

  async totalCount() {
    return this.queue.size + this.queue.pending;
  }

  async maybeFillQueue() {
    const { manager } = this.parent;
    if (this.queue.isPaused) return;

    while (this.queue.size < this.queue.concurrency) {
      const job = await manager.reserveJob();
      if (!job) break;
      await this.runJob(job);
    }
  }

  async registerJobHandler(name: string, worker: JobHandler) {
    this.handlers.set(name, worker);
  }

  async runJob(job: JobModel) {
    const { log, manager } = this.parent;
    const { id, name, payload } = job;

    try {
      log.trace({ msg: "Running job", id, name });

      await this.queue.add(async () => {
        const handler = this.handlers.get(name);
        if (!handler) {
          manager.moveJobToFailed(id, { error: "No handler registered for job" });
          return;
        }
        await manager.moveJobToStarted(id);
        const result = await handler(payload, (progress, statusMessage) =>
          manager.updateJobProgress(id, progress, statusMessage)
        );
        await manager.moveJobToCompleted(id, result);      
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An error occurred";
      if (job.options?.attempts && job.options.attempts > 1) {
        await manager.retryJob(job);
      } else {
        await manager.moveJobToFailed(id, { error, errorMessage: message });
      }
    }

    await this.maybeFillQueue();
  }
}
