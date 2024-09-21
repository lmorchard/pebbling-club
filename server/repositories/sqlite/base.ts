import fs from "fs/promises";
import { constants as fsConstants } from "fs";
import path from "path";
import Knex from "knex";
import { mkdirp } from "mkdirp";
import { v4 as uuid } from "uuid";
import sqlite3 from "sqlite3";
import { AppModule } from "../../app/modules";

export default class BaseSqliteKnexRepository extends AppModule {
  _connection?: Knex.Knex<any, unknown[]>;

  async init() {
    await this.maybeInitializeDatabase();
  }

  async deinit() {
    if (this._connection) this._connection.destroy();
  }
  
  async maybeInitializeDatabase() {
    const { log } = this;
    const { config } = this.app;
    // Attempt to access the database...
    const connectionOptions =
      this.knexConnectionOptions() as Knex.Knex.Sqlite3ConnectionConfig;
    try {
      await fs.access(
        connectionOptions.filename,
        fsConstants.R_OK | fsConstants.W_OK
      );
    } catch (err) {
      // Failed to access database, assume it doesn't exist
      // TODO: check if it's actually a permission problem
      log.trace({ msg: "sqlite database access failed", err });
      log.info({
        msg: "initializing sqlite database",
        filename: connectionOptions.filename,
      });
      await mkdirp(config.get("sqliteDatabasePath"));
      await this.connection.migrate.latest();
    }
  }

  get migrationsDirectory() {
    return path.resolve(path.join(__dirname, "migrations"));
  }

  get connection() {
    const { log } = this;
    const { config } = this.app;

    if (this._connection) {
      return this._connection;
    }

    log.trace({ msg: "buildDatabaseConnection" });

    const migrations: Knex.Knex.MigratorConfig = {
      directory: this.migrationsDirectory,
      extension: "ts",
    };

    const pool: Knex.Knex.PoolConfig = {
      min: 1,
      max: config.get("sqliteDatabaseMaxConnections"),
      afterCreate: (
        conn: sqlite3.Database,
        done: (err: Error | null) => void
      ) => {
        this.connectionAfterCreate(conn)
          .then(() => done(null))
          .catch(done)
      },
    };

    this._connection = Knex({
      client: "sqlite3",
      useNullAsDefault: true,
      connection: this.knexConnectionOptions(),
      debug: config.get("logLevel") === "trace",
      migrations,
      pool,
    });

    return this._connection;
  }

  knexConnectionOptions(): Knex.Knex.Config["connection"] {
    const { config } = this.app;

    return {
      filename: path.join(
        config.get("sqliteDatabasePath"),
        config.get("sqliteDatabaseName")
      ),
    };
  }

  async connectionAfterCreate(conn: sqlite3.Database) {
    const { config } = this.app;

    // Cribbing some notes from here https://phiresky.github.io/blog/2020/sqlite-performance-tuning/
    const statements = `
      PRAGMA busy_timeout = ${config.get("sqliteDatabaseBusyTimeout")};
      PRAGMA mmap_size = ${config.get("sqliteDatabaseMmapSize")};
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = normal;
      PRAGMA temp_store = memory;
    `
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => !!line);

    const run = (statement: string) =>
      new Promise<void>((resolve, reject) =>
        conn.run(statement, (err: Error) => (err ? reject(err) : resolve()))
      );

    for (const statement of statements) {
      await run(statement);
    }
  }
}
