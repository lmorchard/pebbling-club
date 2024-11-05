import { BaseApp } from "@/app";
import { IApp } from "@/app/types";
import SqliteJobsRepository from "@/repositories/sqlite/jobs";
import { rimraf } from "rimraf";
import { JobsService } from ".";
import { JobModelNew } from "./types";

export function createTestJobs(amount: number = 10): JobModelNew[] {
  return Array.from({ length: amount }, (_, i) => ({
    name: `test-job-${i}`,
    payload: { i, foo: "bar" },
    options: { priority: i },
  }));
}

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
