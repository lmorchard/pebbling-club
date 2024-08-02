import path from "path";
import Knex from "knex";
import { v4 as uuid } from "uuid";
import { App } from "../../app";
import { IKnexConnectionOptions } from "../knex";
import { BookmarkEditable, IBookmarksRepository } from "../../services/bookmarks";
import { Profile, ProfileEditable, IProfilesRepository } from "../../services/profiles";
import { CliAppModule } from "../../app/modules";
import { IPasswordsRepository } from "../../services/passwords";
import { ISessionsRepository } from "../../services/sessions";

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
} as const;

export class SqliteRepository
  extends CliAppModule
  implements
    IBookmarksRepository,
    IPasswordsRepository,
    ISessionsRepository,
    IProfilesRepository,
    IKnexConnectionOptions
{
  _connection?: Knex.Knex<any, unknown[]>;

  async deinit() {
    if (this._connection) this._connection.destroy();
    return this;
  }

  get connection() {
    const { log } = this;
    const { config } = this.app;

    if (!this._connection) {
      log.trace({ msg: "buildDatabaseConnection" });
      this._connection = Knex({
        client: "sqlite3",
        useNullAsDefault: true,
        connection: this.knexConnectionOptions(),
        pool: {
          min: 1,
          max: config.get("sqliteDatabaseMaxConnections"),
          // afterCreate: this.connectionAfterCreate.bind(this),
        },
      });
    }

    return this._connection;
  }

  knexConnectionOptions(): Knex.Knex.Config["connection"] {
    const { config } = this.app;

    const dataPath = config.get("dataPath");
    const databaseName = config.get("sqliteDatabaseName");
    const databasePath = path.join(dataPath, databaseName);

    return { filename: databasePath };
  }

  async listAllUsers(): Promise<
    {
      id: string;
      username: string;
      passwordHashed: string;
      salt: string;
    }[]
  > {
    return this.connection("passwords").select(
      "id",
      "username",
      "passwordHashed",
      "salt"
    );
  }

  async createHashedPasswordAndSaltForUsername(
    username: string,
    passwordHashed: string,
    salt: string
  ): Promise<string> {
    const id = uuid();
    await this.connection("passwords").insert({
      id,
      username,
      passwordHashed,
      salt,
    });
    return id;
  }

  async updateHashedPasswordAndSaltForUsername(
    username: string,
    passwordHashed: string,
    salt: string
  ) {
    return await this.connection("passwords")
      .where("username", username)
      .update({
        username,
        passwordHashed,
        salt,
      });
  }

  async getHashedPasswordAndSaltForUsername(
    username: string
  ): Promise<undefined | { id: string; hashedPassword: string; salt: string }> {
    const result = await this.connection("passwords")
      .select("id", "passwordHashed", "salt")
      .where("username", username)
      .first();
    if (!result) return;
    const { id, salt, passwordHashed } = result;
    return {
      id,
      salt,
      hashedPassword: passwordHashed,
    };
  }

  async checkIfPasswordExistsForUsername(username: string): Promise<boolean> {
    const result = await this.connection("passwords")
      .select("id")
      .where({ username })
      .first();
    return !!result;
  }

  async getUsernameById(id: string): Promise<undefined | string> {
    const result = await this.connection("passwords")
      .select("username")
      .where({ id })
      .first();
    if (!result) return;
    return result.username;
  }

  async getIdByUsername(username: string): Promise<undefined | string> {
    const result = await this.connection("passwords")
      .select("id")
      .where({ username })
      .first();
    if (!result) return;
    return result.id;
  }

  async deleteHashedPasswordAndSaltForId(id: string): Promise<string> {
    return this.connection("passwords").where("id", id).del();
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

  async _upsertOneBookmark(
    bookmark: BookmarkEditable,
    now: number,
    connection: Knex.Knex
  ) {
    const created = bookmark.created || now;
    const modified = bookmark.modified || now;
    return await connection("bookmarks")
      .insert({
        ...bookmark,
        id: uuid(),
        created,
        modified,
      })
      .onConflict(["ownerId", "href"])
      .merge();
  }

  async upsertBookmark(bookmark: BookmarkEditable) {
    const now = Date.now();
    await this._upsertOneBookmark(bookmark, now, this.connection);
  }

  async upsertBookmarksBatch(bookmarks: BookmarkEditable[]) {
    const now = Date.now();
    await this.connection.transaction(async (trx) => {
      for (const bookmark of bookmarks) {
        const created = bookmark.created || now;
        const modified = bookmark.modified || now;
        await this._upsertOneBookmark(bookmark, now, trx);
      }
    });
  }

  async listBookmarksForOwner(ownerId: string, limit: number): Promise<any> {
    return this.connection("bookmarks")
      .where({ ownerId })
      .limit(limit)
      .orderBy("created", "desc");
  }

  async checkIfProfileExistsForUsername(username: string): Promise<boolean> {
    const result = await this.connection("profiles")
      .select("id")
      .where({ username })
      .first();
    return !!result;
  }

  async createProfile(profile: Profile): Promise<string> {
    const id = uuid();
    const now = Date.now();
    await this.connection("profiles").insert({
      ...profile,
      id,
      created: profile.created?.getTime() || now,
      modified: profile.modified?.getTime() || now,
    });
    return id;
  }

  async updateProfile(id: string, profile: ProfileEditable): Promise<void> {
    await this.connection("profiles")
      .where({ id })
      .update({
        ...profile,
        modified: Date.now(),
      });
  }

  async getProfile(id: string): Promise<Profile> {
    return this.connection("profiles").where({ id }).first();
  }

  async getProfileByUsername(username: string): Promise<Profile> {
    return this.connection("profiles").where({ username }).first();
  }

  async deleteProfile(id: string): Promise<void> {
    return await this.connection("profiles").where({ id }).del();
  }
}
