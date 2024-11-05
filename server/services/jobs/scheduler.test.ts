import { describe, it, beforeEach, afterEach, mock } from "node:test";
import { BaseApp } from "../../app";
import { IApp } from "../../app/types";
import { rimraf } from "rimraf";
import { BaseJobScheduleModel, JobsService, JobState } from ".";
import SqliteJobsRepository from "../../repositories/sqlite/jobs";
import assert from "node:assert";

describe("services/jobs", () => {
  let app: TestApp;
  let oldPollInterval: number;

  beforeEach(async () => {
    app = new TestApp();
    oldPollInterval = app.config.get("jobsPollIntervalPeriod");
    app.config.set("jobsPollIntervalPeriod", 100);
    app.jobs.pause();
    await app.init();
  });

  afterEach(async () => {
    app.config.set("jobsPollIntervalPeriod", oldPollInterval);
    await app.deinit();
  });

  describe("JobsServiceScheduler", () => {
    describe("upsertJobSchedule", () => {
      it("should upsert a job schedule with nextMillis calculated", async () => {
        const key = "test-schedule-every";
        const now = Date.now();
        const every = 10000;
        const expectedNextMillis = now + every;

        const schedule = await app.jobs.upsertJobSchedule(
          key,
          { every },
          { name: "test-1", payload: { foo: "bar" } }
        );
        assert(schedule.nextMillis);
        assert.equal(
          Math.floor(schedule.nextMillis / 10),
          Math.floor(expectedNextMillis / 10)
        );

        const storedSchedule = await app.jobs.scheduler.fetchJobSchedule(key);
        assert(storedSchedule);
        assert(storedSchedule.nextMillis);
        assert.equal(
          Math.floor(storedSchedule.nextMillis / 10),
          Math.floor(expectedNextMillis / 10)
        );
      });
    });

    describe("listReadyJobSchedules", () => {
      it("should only list schedules for which there are no pending jobs", async () => {
        const key = "test-schedule-1";
        const every = 10000;

        const schedule = await app.jobs.upsertJobSchedule(
          key,
          { every },
          { name: "test-1", payload: { foo: "bar" } }
        );

        const schedules = await app.jobs.scheduler.listReadyJobSchedules();
        assert.equal(schedules.length, 1);
        assert.equal(schedules[0].key, key);

        // now add a job for this schedule
        const jobId = await app.jobs.manager.add("test-1", { foo: "bar" });

        // set the schedule's jobId to the id of the job just created
        schedule.jobId = jobId;
        await app.jobs.scheduler.saveJobSchedule(schedule);

        const schedules2 = await app.jobs.scheduler.listReadyJobSchedules();
        assert.equal(schedules2.length, 0);

        // now mark the job as complete
        const jobs = await app.jobs.manager.listJobs();
        await app.jobs.manager.updateJobState(jobs[0].id, JobState.Completed);

        const schedules3 = await app.jobs.scheduler.listReadyJobSchedules();
        assert.equal(schedules3.length, 1);
      });
    });

    describe("checkSchedules", () => {
      it("should add a job for a schedule that is ready", async () => {
        const now = Date.now();
        const every = 10000;

        // Create one schedule that is ready
        const key = "test-schedule-1";
        const schedule = await app.jobs.upsertJobSchedule(
          key,
          { every },
          { name: "test-1", payload: { foo: "bar" } }
        );
        schedule.nextMillis = now - 5000;
        await app.jobs.scheduler.saveJobSchedule(schedule);

        // Create another schedule
        const key2 = "test-schedule-2";
        const schedule2 = await app.jobs.upsertJobSchedule(
          key2,
          { every },
          { name: "test-2", payload: { foo: "bar" } }
        );
        schedule2.nextMillis = now - 5000;
        await app.jobs.scheduler.saveJobSchedule(schedule2);

        // Add a job for the second schedule, so it's not ready
        const jobId = await app.jobs.manager.add("test-2", { foo: "bar" });
        schedule2.jobId = jobId;
        await app.jobs.scheduler.saveJobSchedule(schedule2);

        // Only one job should exist, so far
        const jobs = await app.jobs.manager.listJobs();
        assert.equal(jobs.length, 1);
        assert.equal(jobs[0].name, "test-2");

        // Check schedules and add jobs
        await app.jobs.scheduler.checkSchedules();

        // Now two jobs should exist
        const jobs2 = await app.jobs.manager.listJobs();
        assert.equal(jobs2.length, 2);
        assert.equal(jobs2[0].name, "test-2");
        assert.equal(jobs2[1].name, "test-1");
      });
    });
  });

  describe("BaseJobScheduleModel", () => {
    describe("calculateNextExecutionTime", () => {
      it("should calculate the next execution time based on `every` option", () => {
        const prevMillis = Date.now();
        const every = 10000;

        const schedule = BaseJobScheduleModel.create(
          "test-schedule-every",
          { every },
          { name: "test-1", payload: { foo: "bar" } }
        );

        const nextMillis = schedule.calculateNextExecutionTime(prevMillis);
        assert.equal(nextMillis, prevMillis + every);
      });

      it("should ensure with `every` option that the job is scheduled in the future", () => {
        const pastFactor = 3.5;
        const every = 1000;
        const now = Date.now();
        const schedule = BaseJobScheduleModel.create(
          "test-schedule-every",
          { every },
          { name: "test-1", payload: { foo: "bar" } }
        );
        schedule.prevMillis = now - every * (pastFactor + 1);
        schedule.nextMillis = now - every * pastFactor;

        schedule.advanceNextMillis();

        assert(schedule.nextMillis > now);
      });

      it("should calculate the next execution time based on `pattern` option", () => {
        // Every half-hour should mean that even counting from 12 minutes after
        // the hour yields 30 min after the hour
        const pattern = "* 30 * * * *";
        const prevDate = "2024-11-17T12:12:00.000Z";
        const expectedNextDate = "2024-11-17T12:30:00.000Z";

        const schedule = BaseJobScheduleModel.create(
          "test-schedule-pattern",
          { pattern },
          { name: "test-1", payload: { foo: "bar" } }
        );

        const prevMillis = new Date(prevDate).getTime();
        const nextMillis = schedule.calculateNextExecutionTime(prevMillis);
        assert.equal(new Date(nextMillis).toISOString(), expectedNextDate);
      });

      it("should ensure with `pattern` option that the job is scheduled in the future", () => {
        const pattern = "*/5 * * * * *";
        const now = 1732481921066;

        const schedule = BaseJobScheduleModel.create(
          "test-schedule-pattern",
          { pattern },
          { name: "test-1", payload: { foo: "bar" } }
        );
        schedule.prevMillis = now - 1000 * 11;
        schedule.nextMillis = now - 1000 * 6;

        schedule.advanceNextMillis();

        assert(schedule.nextMillis > now);
      });
    });
  });
});

export class TestApp extends BaseApp implements IApp {
  jobsRepository = new SqliteJobsRepository(this);
  jobs = new JobsService(this);

  constructor(
    testDatabasePath = `data/test/jobs/${Date.now()}-${Math.random()}`
  ) {
    super();
    const app = this;
    this.modules.push(this.jobsRepository, this.jobs);
    this.config.set("sqliteDatabasePath", testDatabasePath);
  }

  async init() {
    await rimraf(this.config.get("sqliteDatabasePath"));
    return super.init();
  }

  async deinit() {
    await rimraf(this.config.get("sqliteDatabasePath"));
    return super.deinit();
  }
}
