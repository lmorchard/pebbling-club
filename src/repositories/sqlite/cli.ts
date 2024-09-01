import { SqliteRepository } from ".";
import { Cli } from "../../app/cli";
import { KnexCliAppModule } from "../knex";

export default class CliSqlite extends KnexCliAppModule {
  async initCli(cli: Cli) {
    const { app } = this;
    const { program } = cli;
    const repository = new SqliteRepository(app);
    const connection = repository.connection;

    const databaseProgram = program
      .command("sqlite")
      .description("sqlite db management commands");

    this.initKnexCli(databaseProgram, connection);

    return this;
  }
}
