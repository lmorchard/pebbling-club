import path from "path";
import Knex from "knex";

import { BaseRepository } from "../index";
import { mkdirp } from "mkdirp";
import { Cli } from "../../cli";

type KnexMigratorCommandName = keyof Knex.Knex.Migrator;

type KnexMigratorParameters<N extends KnexMigratorCommandName> = Parameters<
  Knex.Knex.Migrator[N]
>;

type KnexSeederCommandName = keyof Knex.Knex.Seeder;

type KnexSeederParameters<N extends KnexSeederCommandName> = Parameters<
  Knex.Knex.Seeder[N]
>;

export const configSchema = {
  sqliteDatabaseName: {
    doc: "Filename for sqlite3 database",
    env: "SQLITE_FILENAME",
    format: String,
    default: "data.sqlite3",
  },
  sqliteDatabaseBusyTimeout: {
    doc: "Time (in ms) for SQLite busy_timeout",
    env: "SQLITE_BUSY_TIMEOUT",
    format: Number,
    default: 1000,
  },
  sqliteDatabaseMaxConnections: {
    doc: "sqlite max connections",
    env: "SQLITE_MAX_CONNECTIONS",
    format: Number,
    default: 16,
  },
  sqliteDatabaseMigrationsPath: {
    doc: "Path to the directory containing Knex database migrations",
    env: "DATABASE_MIGRATIONS_PATH",
    format: String,
    default: "./src/repositories/sqlite/migrations",
  },
  sqliteDatabaseSeedsPath: {
    doc: "Path to the directory containing Knex database seeds",
    env: "DATABASE_SEEDS_PATH",
    format: String,
    default: "./src/repositories/sqlite/seeds",
  },
} as const;

export class SqliteRepository extends BaseRepository {
  _connection?: Knex.Knex<any, unknown[]>;

  async init() {
    const { config, log } = this.app.context;

    return this;
  }

  async deinit() {
    if (this._connection) {
      this._connection.destroy();
    }
    return this;
  }

  async postCliAction() {
    this.deinit();
  }

  get connection() {
    const { config, log } = this.app.context;

    if (!this._connection) {
      log.trace({ msg: "buildDatabaseConnection" });

      const dataPath = config.get("dataPath");
      mkdirp.sync(dataPath);

      const databaseName = config.get("sqliteDatabaseName");
      const databasePath = path.join(dataPath, databaseName);

      this._connection = Knex({
        client: "sqlite3",
        useNullAsDefault: true,
        connection: { filename: databasePath },
        pool: {
          min: 1,
          max: config.get("sqliteDatabaseMaxConnections"),
          // afterCreate: this.connectionAfterCreate.bind(this),
        },
      });
    }

    return this._connection;
  }

  async initCli(cli: Cli) {
    const { program } = cli;

    const databaseProgram = program
      .command("sqlite")
      .description("knex sqlite database maintenance operations");

    databaseProgram
      .command("init")
      .description("init sqlite database")
      .action(this.runInit.bind(this));

    const migrateProgram = databaseProgram
      .command("migrate")
      .description("database migration operations");

    migrateProgram
      .command("make <name>")
      .description("create a new migration")
      .action((name) =>
        this.runMigratorCommand("make", name, this.migratorConfig())
      );

    migrateProgram
      .command("latest")
      .description("run all migrations")
      .action(() => this.runMigratorCommand("latest", this.migratorConfig()));

    migrateProgram
      .command("up")
      .description("run the next migration")
      .action(() => this.runMigratorCommand("up", this.migratorConfig()));

    migrateProgram
      .command("down")
      .description("undo the last migration")
      .action(() => this.runMigratorCommand("down", this.migratorConfig()));

    migrateProgram
      .command("currentVersion")
      .description("show the latest migration version")
      .action(() =>
        this.runMigratorCommand("currentVersion", this.migratorConfig())
      );

    migrateProgram
      .command("list")
      .description("list applied migrations")
      .action(() => this.runMigratorCommand("list", this.migratorConfig()));

    const seedProgram = databaseProgram
      .command("seed")
      .description("database seed operations");

    seedProgram
      .command("make <name>")
      .description("make a new seed file")
      .action((name) => this.runSeederCommand("make", name, this.seederConfig()));

    seedProgram
      .command("run")
      .description("run all seed files")
      .action((name) => this.runSeederCommand("run", this.seederConfig()));

    return this;
  }

  async runInit() {
    const { connection } = this;
    await connection.migrate.latest(this.migratorConfig());
    await connection.seed.run(this.seederConfig());
  }

  migratorConfig() {
    const { config } = this.app.context;
    return {
      directory: config.get("sqliteDatabaseMigrationsPath"),
      extension: "cjs",
    };
  }

  seederConfig() {
    const { config } = this.app.context;
    return {
      directory: config.get("sqliteDatabaseSeedsPath"),
      extension: "cjs",
    };
  }

  async runMigratorCommand<CommandName extends KnexMigratorCommandName>(
    name: CommandName,
    ...args: KnexMigratorParameters<CommandName>
  ) {
    const { config, log } = this.app.context;
    const { connection } = this;
    /* @ts-ignore can't figure out the right handling for ...args */
    const result = await connection.migrate[name](...args);
    log.info({ msg: name, result });
  }

  async runSeederCommand<CommandName extends KnexSeederCommandName>(
    name: CommandName,
    ...args: KnexSeederParameters<CommandName>
  ) {
    const { config, log } = this.app.context;
    const { connection } = this;
    /* @ts-ignore can't figure out the right handling for ...args */
    const result = await connection.seed[name](...args, this.seederConfig);
    log.info({ msg: name, result });
  }
}
