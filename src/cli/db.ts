import { Command } from "commander";
import { CliAppModule } from "../app/modules";
import { buildKnexProgram } from "../repositories/knex";
import { SqliteRepository } from "../repositories/sqlite";
import SqliteFeedsRepository from "../repositories/sqlite/feeds";
import SqliteFetchRepository from "../repositories/sqlite/fetch";

export type IAppRequirements = {
  repository: SqliteRepository;
  feedsRepository: SqliteFeedsRepository;
  fetchRepository: SqliteFetchRepository;
};

export default class CliFeeds extends CliAppModule<IAppRequirements> {
  async initCli(program: Command) {
    const { log, app } = this;
    const { repository, feedsRepository, fetchRepository } = app;

    const dbProgram = program
      .command("db")
      .description("manage db repositories");

    dbProgram
      .command("migrate")
      .description("migrate all databases to latest version")
      .action(async () => {
        log.info({
          msg: "migrate main db",
          result: await repository.connection.migrate.latest(),
        });
        log.info({
          msg: "migrate feeds db",
          result: await feedsRepository.connection.migrate.latest(),
        });
        log.info({
          msg: "migrate fetch db",
          result: await fetchRepository.connection.migrate.latest(),
        });
      });

    const mainDbProgram = dbProgram
      .command("main")
      .description("main repository commands");

    buildKnexProgram(mainDbProgram, repository.connection, log);

    const feedsDbProgram = dbProgram
      .command("feeds")
      .description("feeds repository commands");

    buildKnexProgram(feedsDbProgram, feedsRepository.connection, log);

    const fetchDbProgram = dbProgram
      .command("fetch")
      .description("fetch repository commands");

    buildKnexProgram(fetchDbProgram, fetchRepository.connection, log);
  }
}
