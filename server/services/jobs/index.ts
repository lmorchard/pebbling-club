import { AppModule } from "../../app/modules";
import { JobsServiceManager } from "./manager";
import { JobsServiceQueue } from "./queue";
import { JobsServiceScheduler } from "./scheduler";
import { JobScheduleModel } from "./types";

import { JobState, JobResult, JobModelNew, JobModel, JobStatus } from "./types";

export * from "./types";
export * from "./scheduler";

export const configSchema = {
  jobsQueueConcurrency: {
    doc: "Number of jobs to run concurrently",
    env: "JOBS_QUEUE_CONCURRENCY",
    format: Number,
    default: 4,
  },
  jobsPollIntervalPeriod: {
    doc: "Interval in milliseconds to poll for new jobs",
    env: "JOBS_POLL_INTERVAL_PERIOD",
    format: Number,
    default: 1000,
  },
  jobsSchedulerPollIntervalPeriod: {
    doc: "Interval in milliseconds to poll for schedules",
    env: "JOBS_SCHEDULER_POLL_INTERVAL_PERIOD",
    format: Number,
    default: 1000,
  },
  jobPurgeInterval: {
    doc: "Interval in milliseconds to purge resolved jobs",
    env: "JOBS_PURGE_INTERVAL",
    format: Number,
    default: 1000 * 60 * 60 * 24,
  },
};

export interface IAppRequirements {
  jobsRepository: IJobsRepository;
}

export class JobsService extends AppModule<IAppRequirements> {
  // TODO: make these #private or use a WeakMap someday, to more explicitly
  // define external JobsService interface?
  manager: JobsServiceManager = new JobsServiceManager(this);
  queue: JobsServiceQueue = new JobsServiceQueue(this);
  scheduler: JobsServiceScheduler = new JobsServiceScheduler(this);

  async init() {
    await this.manager.init();
    await this.queue.init();
    await this.scheduler.init();
    await super.init();
  }

  async deinit() {
    await this.scheduler.deinit();
    await this.queue.deinit();
    await this.manager.deinit();
    await super.deinit();
  }

  async start() {
    await this.queue.start();
    await this.scheduler.start();
  }

  async pause() {
    await this.scheduler.pause();
    await this.queue.pause();
  }

  add = this.manager.add.bind(this.manager);
  addBulk = this.manager.addBulk.bind(this.manager);
  registerJobHandler = this.queue.registerJobHandler.bind(this.queue);
  upsertJobSchedule = this.scheduler.upsertJobSchedule.bind(this.scheduler);
  onIdle = this.queue.onIdle.bind(this.queue);

  async isIdle() {
    return this.queue.queue.size === 0 && this.queue.queue.pending === 0;
  }
}

export interface IJobsRepository {
  addJob(jobs: JobModelNew[]): Promise<string[]>;
  listJobs(options?: {
    name?: string;
    limit?: number;
    offset?: number;
  }): Promise<JobModel[]>;
  fetchJobById(id: string): Promise<JobModel | undefined>;
  reserveJob(jobNames?: string[]): Promise<JobModel | undefined>;
  retryJob(job: JobModel): Promise<void>;
  updateJob<Result extends JobResult>({
    id,
    state,
    status,
    result,
  }: {
    id: string;
    state?: JobState;
    status?: JobStatus;
    result?: Result;
  }): Promise<void>;
  purgeResolvedJobs(): Promise<void>;
  upsertJobSchedule(schedule: JobScheduleModel): Promise<JobScheduleModel>;
  fetchJobSchedule(key: string): Promise<JobScheduleModel | undefined>;
  listReadyJobSchedules(limit: number): Promise<JobScheduleModel[]>;
}
