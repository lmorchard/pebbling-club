import { JobsService } from ".";
import { JobModelNew, JobRepeatOptions, JobScheduleModel } from "./types";
import CronParser from "cron-parser";

export const JOB_PURGE_RESOLVED_JOBS = "purgeResolvedJobs";

export class JobsServiceScheduler {
  parent: JobsService;
  schedulerPollIntervalTimer: NodeJS.Timeout | null = null;

  constructor(parent: JobsService) {
    this.parent = parent;
  }

  async init() {}

  async deinit() {
    await this.pause();
  }

  async start() {
    const { log, app } = this.parent;
    const { config } = app;

    log.debug({ msg: "starting jobs scheduler" });

    await this.parent.registerJobHandler(JOB_PURGE_RESOLVED_JOBS, async () => {
      await this.parent.manager.purgeResolvedJobs();
      return { success: true };
    });

    if (this.schedulerPollIntervalTimer)
      clearInterval(this.schedulerPollIntervalTimer);
    this.schedulerPollIntervalTimer = setInterval(
      () => this.checkSchedules(),
      config.get("jobsSchedulerPollIntervalPeriod")
    );
  }

  async pause() {
    if (this.schedulerPollIntervalTimer)
      clearInterval(this.schedulerPollIntervalTimer);
  }

  async scheduleJobPurge() {
    const { log } = this.parent;
    log.debug({ msg: "scheduling job purge" });
    await this.upsertJobSchedule(
      `schedule-periodic-${JOB_PURGE_RESOLVED_JOBS}`,
      { every: this.parent.app.config.get("jobPurgeInterval") },
      { name: JOB_PURGE_RESOLVED_JOBS, payload: {} }
    );
  }

  async checkSchedules() {
    const schedules = await this.listReadyJobSchedules();

    for (const schedule of schedules as BaseJobScheduleModel[]) {
      // Advance the schedule to the next future execution time
      schedule.advanceNextMillis();

      // Create a new job for this schedule and defer it until the next execution time
      const jobId = await this.parent.manager.add(
        schedule.jobTemplate.name,
        schedule.jobTemplate.payload,
        {
          ...schedule.jobTemplate.options,
          deduplication: {
            id: schedule.jobTemplate.options?.deduplication?.id || schedule.key,
          },
          deferUntil: schedule.nextMillis,
        }
      );

      // Update the schedule with the new job ID
      if (jobId) {
        schedule.jobId = jobId;
        await this.saveJobSchedule(schedule);
      }
    }
  }

  async upsertJobSchedule(
    key: string,
    repeatOptions: JobRepeatOptions,
    jobTemplate: JobModelNew
  ) {
    const jobSchedule = BaseJobScheduleModel.create(
      key,
      repeatOptions,
      jobTemplate
    );
    jobSchedule.advanceNextMillis();
    return this.parent.app.jobsRepository.upsertJobSchedule(jobSchedule);
  }

  async saveJobSchedule(jobSchedule: JobScheduleModel) {
    // TODO: move this to a job model method?
    return this.parent.app.jobsRepository.upsertJobSchedule(jobSchedule);
  }

  async fetchJobSchedule(key: string) {
    return this.parent.app.jobsRepository.fetchJobSchedule(key);
  }

  async listReadyJobSchedules(limit: number = 10) {
    return this.parent.app.jobsRepository.listReadyJobSchedules(limit);
  }
}

export class BaseJobScheduleModel implements JobScheduleModel {
  key!: string;
  repeatOptions!: JobRepeatOptions;
  jobTemplate!: JobModelNew;

  jobId?: string | undefined;
  count?: number | undefined;
  prevMillis?: number | undefined;
  nextMillis?: number | undefined;

  constructor(init: JobScheduleModel) {
    Object.assign(this, init);
  }

  static create(
    key: string,
    repeatOptions: JobRepeatOptions,
    jobTemplate: JobModelNew
  ) {
    return new BaseJobScheduleModel({ key, repeatOptions, jobTemplate });
  }

  advanceNextMillis(now: number = Date.now()) {
    // TODO: need a panic count after which to break infinite loop and schedule arbitrarily into the future?
    while (!this.nextMillis || this.nextMillis < now) {
      this.prevMillis = this.nextMillis || now;
      this.nextMillis = this.calculateNextExecutionTime(this.prevMillis);
    }
  }

  calculateNextExecutionTime(prevMillis: number) {
    if ("every" in this.repeatOptions) {
      return prevMillis + this.repeatOptions.every;
    }
    const interval = CronParser.parseExpression(this.repeatOptions.pattern, {
      currentDate: new Date(prevMillis),
    });
    const next = interval.next();
    return next.getTime();
  }
}
