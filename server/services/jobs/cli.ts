import { Command } from "commander";
import { CliAppModule } from "../../app/modules";
import { IJobsRepository, JobsService } from ".";

export type IAppRequirements = {
  jobs: JobsService;
  jobsRepository: IJobsRepository;
};

export default class CliUnfurl extends CliAppModule<IAppRequirements> {
  async initCli(program: Command) {
    const { log } = this;
    const { jobs, jobsRepository } = this.app;

    const jobsProgram = program
      .command("jobs")
      .description("manage background jobs");

    jobsProgram
      .command("list")
      .description("list jobs")
      .action(async () => {
        const jobs = await jobsRepository.listJobs();
        log.info({ msg: "jobs", jobs });
      });
  }
}
