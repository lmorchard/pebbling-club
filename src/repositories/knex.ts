import Knex from "knex";
import { AppModule, CliAppModule } from "../app/modules";
import { Command } from "commander";

export interface IKnexConnectionOptions {
  knexConnectionOptions(): Knex.Knex.Config["connection"];
}

export interface IKnexRepository {
  get connection(): Knex.Knex;
}

export class KnexCliAppModule extends CliAppModule {
  connection?: Knex.Knex;

  async initKnexCli(databaseProgram: Command, connection: Knex.Knex) {
    const { log } = this;

    this.connection = connection;

    const migrateProgram = databaseProgram
      .command("migrate")
      .description("database migration operations");

    migrateProgram.hook("postAction", () => connection.destroy());

    migrateProgram
      .command("make <name>")
      .description("create a new migration")
      .action(async (name) => {
        const result = await connection.migrate.make(name);
        log.info({ msg: "migration make", result });
      });

    migrateProgram
      .command("current-version")
      .description("show current migration version")
      .action(async () => {
        const result = await connection.migrate.currentVersion();
        log.info({ msg: "migration current-version", result });
      });

    migrateProgram
      .command("latest")
      .description("run all migrations up to latest")
      .action(async () => {
        const result = await connection.migrate.latest();
        log.info({ msg: "migration latest", result });
      });

    migrateProgram
      .command("up")
      .description("run the next migration")
      .action(async () => {
        const result = await connection.migrate.up();
        log.info({ msg: "migration up", result });
      });

    migrateProgram
      .command("down")
      .description("undo the last migration")
      .action(async () => {
        const result = await connection.migrate.down();
        log.info({ msg: "migration down", result });
      });

    migrateProgram
      .command("list")
      .description("list migrations")
      .action(async () => {
        const result = await connection.migrate.list();
        log.info({ msg: "migration list", result });
      });
  }
}
