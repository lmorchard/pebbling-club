import path from "path";
import Knex from "knex";
import { v4 as uuid } from "uuid";
import { BaseRepository } from "../base";
import { mkdirp } from "mkdirp";
import { Cli } from "../../cli";

import { SqliteRepositoryCli } from "./cli";
import { App } from "../../app";

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
  cli: SqliteRepositoryCli;
  _connection?: Knex.Knex<any, unknown[]>;

  constructor(app: App) {
    super(app);
    this.cli = new SqliteRepositoryCli(this);
  }

  async init() {
    const { config, log } = this.app.context;
    return this;
  }

  async initCli(cli: Cli) {
    await this.cli.initCli(cli);
    return this;
  }

  async deinit() {
    if (this._connection) this._connection.destroy();
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

  async createHashedPasswordAndSaltForUsername(
    username: string,
    hashed_password: string,
    salt: string
  ): Promise<string> {
    const id = uuid();
    await this.connection("users").insert({
      id,
      username,
      hashed_password,
      salt,
    });
    return id;
  }

  async updateHashedPasswordAndSaltForUsername(
    username: string,
    hashed_password: string,
    salt: string
  ) {
    await this.connection("users").where("username", username).update({
      username,
      hashed_password,
      salt,
    });
  }

  async getHashedPasswordAndSaltForUsername(
    username: string
  ): Promise<undefined | { id: string; hashedPassword: string; salt: string }> {
    const result = await this.connection("users")
      .select("id", "hashed_password", "salt")
      .where("username", username)
      .first();
    if (!result) return;
    const { id, salt, hashed_password } = result;
    return {
      id,
      salt,
      hashedPassword: hashed_password,
    };
  }

  async getUsernameForId(id: string): Promise<undefined | string> {
    const result = await this.connection("users")
      .select("username")
      .where({ id })
      .first();
    if (!result) return;
    return result.username;
  }

  async deleteHashedPasswordAndSaltForUsername(
    username: string
  ): Promise<string> {
    return this.connection("users").where("username", username).del();
  }

  async deleteSession(id: string) {
    await this.connection("sessions").where({ id }).del();
  }

  async deleteExpiredSessions(maxAge: number) {
    const minDate = Date.now() - maxAge;
    await this.connection("sessions").where("modified", "<", minDate).del();
  }

  async getSession(id: string): Promise<undefined | { session: string }> {
    return this.connection("sessions").select("session").where({ id }).first();
  }

  async putSession(id: string, session: string, modified: Date) {
    await this.connection("sessions")
      .insert({ id, session, modified: modified.getTime() })
      .onConflict("id")
      .merge();
  }
}
