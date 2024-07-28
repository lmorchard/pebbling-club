import Knex from "knex";
import { SqliteRepository } from ".";
import { Cli } from "../../cli";

type KnexMigratorCommandName = keyof Knex.Knex.Migrator;

type KnexMigratorParameters<N extends KnexMigratorCommandName> = Parameters<
  Knex.Knex.Migrator[N]
>;

type KnexSeederCommandName = keyof Knex.Knex.Seeder;

type KnexSeederParameters<N extends KnexSeederCommandName> = Parameters<
  Knex.Knex.Seeder[N]
>;

export class SqliteRepositoryCli {
  parent: SqliteRepository;

  constructor(parent: SqliteRepository) {
    this.parent = parent;
  }

  async initCli(cli: Cli) {
  
    const { program } = cli;
  
    const databaseProgram = program
      .command("sqlite")
      .description("knex sqlite database maintenance operations");
 
    databaseProgram
      .command("play")
      .action(this.runPlay.bind(this));

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
  
  }
  
  async runInit() {
    const { connection } = this.parent;
    await connection.migrate.latest(this.migratorConfig());
    await connection.seed.run(this.seederConfig());
  }
  
  migratorConfig() {
    const { config } = this.parent.app.context;
    return {
      directory: config.get("sqliteDatabaseMigrationsPath"),
      extension: "cjs",
    };
  }
  
  seederConfig() {
    const { config } = this.parent.app.context;
    return {
      directory: config.get("sqliteDatabaseSeedsPath"),
      extension: "cjs",
    };
  }
  
  async runMigratorCommand<CommandName extends KnexMigratorCommandName>(
    name: CommandName,
    ...args: KnexMigratorParameters<CommandName>
  ) {
    const { log } = this.parent.app.context;
    const { connection } = this.parent;
    /* @ts-ignore can't figure out the right handling for ...args */
    const result = await connection.migrate[name](...args);
    log.info({ msg: name, result });
  }
  
  async runSeederCommand<CommandName extends KnexSeederCommandName>(
    name: CommandName,
    ...args: KnexSeederParameters<CommandName>
  ) {
    const { log } = this.parent.app.context;
    const { connection } = this.parent;
    /* @ts-ignore can't figure out the right handling for ...args */
    const result = await connection.seed[name](...args, this.seederConfig);
    log.info({ msg: name, result });
  }  
}
