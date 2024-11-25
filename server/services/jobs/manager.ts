import { JobsService } from ".";
import { JobResult, JobModelNew, JobState, JobModel, JobStatus } from "./types";

export class JobsServiceManager {
  parent: JobsService;

  constructor(parent: JobsService) {
    this.parent = parent;
  }

  async init() {}

  async deinit() {}

  async add(
    name: JobModelNew["name"],
    payload: JobModelNew["payload"],
    options?: JobModelNew["options"]
  ) {
    const ids = await this.addBulk([{ name, payload, options }]);
    return ids[0];
  }

  async addBulk(jobs: JobModelNew[]) {
    const jobIds = await this.parent.app.jobsRepository.addJob(jobs);
    await this.parent.queue.maybeFillQueue();
    return jobIds;
  }

  async reserveJob(jobNames?: string[]) {
    return this.parent.app.jobsRepository.reserveJob(jobNames);
  }

  async pendingCount() {
    // TODO: this is butts, build a proper repository query for this
    return this.parent.app.jobsRepository
      .listJobs()
      .then(
        (jobs) => jobs.filter((job) => job.state === JobState.Pending).length
      );
  }

  async listJobs(options?: { name?: string; limit?: number; offset?: number }) {
    return this.parent.app.jobsRepository.listJobs(options);
  }

  async fetchJob(id: string) {
    return this.parent.app.jobsRepository.fetchJobById(id);
  }

  async moveJobToStarted(id: string) {
    await this.parent.app.jobsRepository.updateJob({
      id,
      state: JobState.Started,
    });
  }

  async updateJobProgress(
    id: string,
    progress: number,
    statusMessage?: string
  ) {
    await this.parent.app.jobsRepository.updateJob({
      id,
      state: JobState.Started,
      status: {
        progress,
        statusMessage,
      },
    });
  }

  async moveJobToCompleted<Result extends JobResult>(
    id: string,
    result?: Result
  ) {
    await this.parent.app.jobsRepository.updateJob({
      id,
      state: JobState.Completed,
      result,
    });
  }

  async moveJobToFailed<Result extends JobResult>(id: string, result?: Result) {
    await this.parent.app.jobsRepository.updateJob({
      id,
      state: JobState.Failed,
      result,
    });
  }

  async retryJob(job: JobModel) {
    await this.parent.app.jobsRepository.retryJob(job);
    await this.parent.queue.maybeFillQueue();
  }

  async updateJobState(id: string, state: JobState, status?: JobStatus) {
    await this.parent.app.jobsRepository.updateJob({ id, state, status });
  }

  async purgeResolvedJobs() {
    await this.parent.app.jobsRepository.purgeResolvedJobs();
  }
}
