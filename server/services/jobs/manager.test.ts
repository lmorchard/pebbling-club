import { describe, it, beforeEach, afterEach } from "node:test";
import { JobModel, JobState } from "./types";
import assert from "node:assert";
import { createTestJobs, TestApp } from "./test-utils";

describe("services/jobs", () => {
  let app: TestApp;

  beforeEach(async () => {
    app = new TestApp();
    await app.init();
  });

  afterEach(async () => {
    await app.deinit();
  });

  describe("JobsServiceManager", () => {
    describe("add", () => {
      it("should add jobs", async () => {
        const { jobs } = app;

        const testJobs = createTestJobs(10);
        const jobIds = await jobs.addBulk(testJobs);

        const fetchedJobs = await app.jobsRepository.listJobs();
        const fetchedJobIds = fetchedJobs.map((job) => job.id);

        assert.deepStrictEqual(jobIds, fetchedJobIds);
      });
    });

    describe("reserve", async () => {
      it("should reserve jobs in order of priority", async () => {
        const { jobs } = app;

        const testJobs = createTestJobs(10);
        const jobIds = await jobs.addBulk(testJobs);

        const reservations = [];

        for (let i = 0; i < testJobs.length; i++) {
          reservations.push(async () => {
            const reservedJob = await jobs.manager.reserveJob();
            assert(reservedJob);
            assert.equal(reservedJob.id, jobIds[i]);
            assert.equal(reservedJob.state, JobState.Reserved);
          });
        }

        // Fire off all the reservation attempts in parallel,
        // the underlying repository should serialize them
        await Promise.all(reservations.map((r) => r()));
      });

      it("should support reserving by job name", async () => {
        const { jobs } = app;

        const testJobs = createTestJobs(10);
        const jobIds = await jobs.addBulk(testJobs);

        const name = testJobs[5].name;
        const reservedJob = await jobs.manager.reserveJob([name]);

        assert(reservedJob);
        assert.equal(reservedJob.id, jobIds[5]);
      });

      it("should support reserving by multiple job names", async () => {
        const { jobs } = app;

        const startIdx = 3;
        const endIdx = 7;

        const testJobs = createTestJobs(10);
        const jobIds = await jobs.addBulk(testJobs);
        const expectedJobIds = jobIds.slice(startIdx, endIdx);
        const names = testJobs.slice(startIdx, endIdx).map((job) => job.name);

        const reservedJobs = [];
        for (let idx = 0; idx < names.length; idx++) {
          const reservedJob = await jobs.manager.reserveJob(names);
          assert(reservedJob);
          reservedJobs.push(reservedJob);
        }

        const reservedJobIds = reservedJobs.map((job) => job.id);
        assert.deepEqual(reservedJobIds, expectedJobIds);
      });

      it("should not reserve completed or failed jobs", async () => {
        const { jobs } = app;

        const testJobs = createTestJobs(10);
        const jobIds = await jobs.addBulk(testJobs);

        const [completedId, failedId, ...pendingIds] = jobIds;

        await jobs.manager.moveJobToCompleted(completedId, { foo: "bar" });
        await jobs.manager.moveJobToFailed(failedId, { baz: "quux" });

        const reservedJobs = [];
        let job: JobModel | undefined;
        while ((job = await jobs.manager.reserveJob())) {
          reservedJobs.push(job);
        }

        assert.equal(reservedJobs.length, pendingIds.length);
      });
    });

    describe("purgeResolvedJobs", () => {
      it("should remove completed and failed jobs", async () => {
        const { jobs } = app;

        const testJobs = createTestJobs(10);
        const jobIds = await jobs.addBulk(testJobs);

        const [completedId, failedId, ...pendingIds] = jobIds;

        await jobs.manager.moveJobToCompleted(completedId, { foo: "bar" });
        await jobs.manager.moveJobToFailed(failedId, { foo: "bar" });
        await jobs.manager.purgeResolvedJobs();

        const fetchedJobs = await app.jobsRepository.listJobs();
        const fetchedJobIds = fetchedJobs.map((job) => job.id);

        assert.deepEqual(fetchedJobIds, pendingIds);
      });
    });

    describe("JobModel.options", () => {
      it("should support a deduplication ID to prevent inserting duplicate jobs", async () => {
        const { jobs } = app;

        const [testJob1, testJob2] = createTestJobs(2);
        const deduplicationId1 = "dedupe-me-1";
        const deduplicationId2 = "dedupe-me-2";

        const jobId1 = await jobs.add(testJob1.name, testJob1.payload, {
          deduplication: { id: deduplicationId1 },
        });

        for (let i = 0; i < 5; i++) {
          const duplicateJobId1 = await jobs.add(
            testJob1.name,
            testJob1.payload,
            {
              deduplication: { id: deduplicationId1 },
            }
          );
          assert.equal(jobId1, duplicateJobId1);
        }

        const jobId2 = await jobs.add(testJob2.name, testJob2.payload, {
          deduplication: { id: deduplicationId2 },
        });
        assert.notEqual(jobId1, jobId2);

        for (let i = 0; i < 5; i++) {
          const duplicateJobId2 = await jobs.add(
            testJob2.name,
            testJob2.payload,
            {
              deduplication: { id: deduplicationId2 },
            }
          );
          assert.equal(jobId2, duplicateJobId2);
        }

        await jobs.manager.reserveJob([testJob1.name]);
        await jobs.manager.reserveJob([testJob2.name]);

        const newJobId1 = await jobs.add(testJob1.name, testJob1.payload, {
          deduplication: { id: deduplicationId1 },
        });
        assert.notEqual(jobId1, newJobId1);

        const newJobId2 = await jobs.add(testJob2.name, testJob2.payload, {
          deduplication: { id: deduplicationId2 },
        });
        assert.notEqual(jobId2, newJobId2);
      });
    });
  });
});
