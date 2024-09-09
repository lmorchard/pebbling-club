import { SqliteRepository } from ".";
import { ICliApp } from "../../app/types";
import { KnexCliAppModule } from "../knex";

export default class CliSqlite extends KnexCliAppModule {
  async initCli(app: ICliApp) {
    const { program } = app;
    const repository = new SqliteRepository(app);
    const connection = repository.connection;

    const databaseProgram = program
      .command("sqlite")
      .description("sqlite db management commands");

    this.initKnexCli(databaseProgram, connection);

    return this;
  }
}
