import path from "path";
import Knex from "knex";
import { v4 as uuid } from "uuid";
import { App } from "../../app";
import { IKnexConnectionOptions } from "../knex";
import {
  Bookmark,
  BookmarkEditable,
  IBookmarksRepository,
} from "../../services/bookmarks";
import {
  Profile,
  ProfileEditable,
  IProfilesRepository,
} from "../../services/profiles";
import { CliAppModule } from "../../app/modules";
import { IPasswordsRepository } from "../../services/passwords";

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

  async fetchBookmark(bookmarkId: string): Promise<Bookmark | null> {
    return this.connection("bookmarks")
      .select("*")
      .where({ id: bookmarkId })
      .first();
  }

  async _upsertOneBookmark(
    bookmark: BookmarkEditable,
    now: number,
    connection: Knex.Knex
  ) {
    const created = bookmark.created || now;
    const modified = bookmark.modified || now;
    const toInsert = {
      id: uuid(),
      created,
      modified,
      ...bookmark,
    };

    const result = await connection("bookmarks")
      .insert(toInsert)
      .onConflict(["ownerId", "href"])
      .merge();

    // Hacky attempt at an optimistic update, will probably mismatch a
    // few fields like created if they're not supplied in the original
    const resultBookmark = {
      ...bookmark,
      id: toInsert.id,
      created: new Date(toInsert.created),
      modified: new Date(toInsert.modified),
    };

    return resultBookmark;
  }

  async upsertBookmark(bookmark: BookmarkEditable) {
    const now = Date.now();
    const result = await this._upsertOneBookmark(
      bookmark,
      now,
      this.connection
    );
    return result;
  }

  async upsertBookmarksBatch(bookmarks: BookmarkEditable[]) {
    const now = Date.now();
    const results: Bookmark[] = [];
    await this.connection.transaction(async (trx) => {
      for (const bookmark of bookmarks) {
        const result = await this._upsertOneBookmark(bookmark, now, trx);
        results.push(result);
      }
    });
    return results;
  }

  async updateBookmark(bookmarkId: string, bookmark: BookmarkEditable) {
    const now = Date.now();
    const result = await this.connection("bookmarks")
      .where({ id: bookmarkId })
      .update({
        ...bookmark,
        modified: now,
      });
    // Hacky attempt at an optimistic update
    const resultBookmark = {
      ...bookmark,
      id: bookmarkId,
      modified: new Date(now),
    };
    return resultBookmark;
  }

  async listBookmarksForOwner(
    ownerId: string,
    limit: number,
    offset: number
  ): Promise<{ total: number; items: Bookmark[] }> {
    const baseQuery = this.connection("bookmarks").where({ ownerId });

    const [countResult, items] = await Promise.all([
      baseQuery.clone().count<Record<string, number>>({ count: "*" }).first(),
      await baseQuery
        .clone()
        .orderBy("created", "desc")
        .limit(limit)
        .offset(offset),
    ]);

    const total = countResult?.count;
    if (!total) throw new Error("total query failed");

    return { total, items };
  }

  async deleteBookmark(bookmarkId: string) {
    const result = await this.connection("bookmarks")
      .where({ id: bookmarkId })
      .del();
    return result > 0;
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
