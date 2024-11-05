import { describe, it, beforeEach, afterEach, mock } from "node:test";
import { JobHandler, JobState } from "./types";
import assert from "node:assert";
import { createTestJobs, TestApp } from "./test-utils";

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

  describe("JobsServiceQueue", () => {
    describe("startQueue", () => {
      it("should start running queued jobs", async () => {
        const { jobs } = app;
        jobs.start();

        const add = mock.fn<JobHandler>(async (payload) => {
          const { a, b } = payload as { a: number; b: number };
          return { sum: a + b };
        });
        jobs.registerJobHandler("add", add);

        const numberOfJobs = 10;
        const testJobs = Array.from({ length: numberOfJobs }, (_, i) => ({
          name: `add`,
          payload: { a: i, b: i + 1 },
        }));
        await jobs.addBulk(testJobs);

        await jobs.onIdle();
        await jobs.pause();

        const fetchedJobs = await app.jobsRepository.listJobs();
        const completedJobs = fetchedJobs.filter(
          (job) => job.state === JobState.Completed
        );
        assert.equal(completedJobs.length, numberOfJobs);

        assert.equal(add.mock.callCount(), numberOfJobs);
        for (const job of completedJobs) {
          assert.deepEqual(
            job.result,
            await add(job.payload as any, async () => {})
          );
        }
      });
    });

    describe("update", () => {
      it("should update job state and status when passed to a job handler", async () => {
        const { jobs } = app;
        jobs.start();

        const testJob = {
          name: "test",
          payload: { foo: "bar" },
        };

        const handler: JobHandler = async (payload, progress) => {
          assert.deepEqual(payload, testJob.payload);
          await progress(0.5, "halfway there");
          return { success: true };
        };

        jobs.registerJobHandler(testJob.name, handler);
        const jobId = await jobs.add(testJob.name, testJob.payload);

        await jobs.onIdle();
        await jobs.pause();

        const fetchedJob = await app.jobsRepository.fetchJobById(jobId);
        assert.equal(fetchedJob?.state, JobState.Completed);
        assert.equal(fetchedJob?.status?.progress, 0.5);
        assert.equal(fetchedJob?.status?.statusMessage, "halfway there");
      });
    });

    describe("registerHandler", () => {
      it("should support many named job handlers", async () => {
        const { jobs } = app;
        jobs.start();

        const numberOfJobs = 10;
        const testJobs = createTestJobs(numberOfJobs);

        // Register a unique handler for every named job using mocks
        const jobMocks = testJobs.map((job) => {
          const handlerMock = mock.fn(async (payload) => ({ success: true }));
          jobs.registerJobHandler(job.name, handlerMock);
          return handlerMock;
        });

        await jobs.addBulk(testJobs);
        await jobs.onIdle();
        await jobs.pause();

        const fetchedJobs = await app.jobsRepository.listJobs();
        const completedJobs = fetchedJobs.filter(
          (job) => job.state === JobState.Completed
        );
        assert(completedJobs.length === numberOfJobs);

        // Verify that each handler was called exactly once
        jobMocks.forEach((handlerMock) => {
          assert.equal(handlerMock.mock.callCount(), 1);
        });
      });
    });

    describe("JobModel.options", () => {
      it("should support an attempt options to specify number of retries", async (t) => {
        const { jobs } = app;

        const maxAttempts = 5;

        const testJob = {
          ...createTestJobs(1)[0],
          options: { attempts: maxAttempts },
        };

        let attempt = 0;
        const handler = mock.fn<JobHandler>(async (payload) => {
          if (attempt++ < maxAttempts - 1) throw new Error("failed");
          return { success: true };
        });
        jobs.registerJobHandler(testJob.name, handler);

        await jobs.add(testJob.name, testJob.payload, {
          attempts: maxAttempts,
        });

        await jobs.start();
        await jobs.onIdle();
        await jobs.pause();

        const fetchedJobs = await app.jobsRepository.listJobs();
        const completedJobs = fetchedJobs.filter(
          (job) => job.state === JobState.Completed
        );
        assert.equal(completedJobs.length, 1);
        assert.equal(handler.mock.callCount(), maxAttempts);
      });

      it("should support deferUntil option to delay job until time", async () => {
        const delay = app.config.get("jobsPollIntervalPeriod") * 1.5;
        const deferUntil = Date.now() + delay;
        await testDelayedJobExecution("deferUntil", deferUntil);
      });

      it("should support delay option to delay job execution for a period", async () => {
        const delay = app.config.get("jobsPollIntervalPeriod") * 1.5;
        await testDelayedJobExecution("delay", delay);
      });

      async function testDelayedJobExecution(
        delayOption: "deferUntil" | "delay",
        delayValue: number
      ) {
        const { jobs } = app;

        const testJob = createTestJobs(1)[0];

        const handler = mock.fn<JobHandler>(async (payload) => ({
          success: true,
        }));
        jobs.registerJobHandler(testJob.name, handler);

        await jobs.add(testJob.name, testJob.payload, {
          [delayOption]: delayValue,
        });

        await jobs.start();
        await jobs.onIdle();

        const fetchedJobs = await app.jobsRepository.listJobs();
        const completedJobs = fetchedJobs.filter(
          (job) => job.state === JobState.Completed
        );
        assert.equal(completedJobs.length, 0);

        await new Promise((resolve) =>
          setTimeout(resolve, app.config.get("jobsPollIntervalPeriod") * 3)
        );

        await jobs.onIdle();
        await jobs.pause();

        const fetchedJobsAfterDelay = await app.jobsRepository.listJobs();
        const completedJobsAfterDelay = fetchedJobsAfterDelay.filter(
          (job) => job.state === JobState.Completed
        );
        assert.equal(completedJobsAfterDelay.length, 1);
        assert.equal(handler.mock.callCount(), 1);
      }
    });
  });
});
