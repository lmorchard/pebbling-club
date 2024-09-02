import fs from "fs/promises";
import { constants as fsConstants } from "fs";
import path from "path";
import Knex from "knex";
import { mkdirp } from "mkdirp";
import { v4 as uuid } from "uuid";
import { IKnexConnectionOptions, IKnexRepository } from "../knex";
import {
  Bookmark,
  BookmarkUpdatable,
  BookmarkCreatable,
  IBookmarksRepository,
  TagCount,
} from "../../services/bookmarks";
import {
  Profile,
  ProfileEditable,
  IProfilesRepository,
} from "../../services/profiles";
import { AppModule, CliAppModule } from "../../app/modules";
import { IPasswordsRepository } from "../../services/passwords";
import { App } from "../../app";

import CliSqlite from "./cli";

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

// TODO: derive type from table?
export type BookmarksRow = {
  id: string;
  ownerId: string;
  href: string;
  title: string;
  extended?: string;
  tags?: string;
  visibility?: string;
  meta?: string;
  created: number;
  modified: number;
};

export type TagItem = {
  name: string;
};

export class SqliteRepository
  extends AppModule
  implements
    IBookmarksRepository,
    IPasswordsRepository,
    IProfilesRepository,
    IKnexRepository,
    IKnexConnectionOptions
{
  _connection?: Knex.Knex<any, unknown[]>;

  async init() {
    const app = this.app as App;

    app.registerModule("sqliteCli", CliSqlite);

    await this.maybeInitializeDatabase();

    return this;
  }

  async deinit() {
    if (this._connection) this._connection.destroy();
    return this;
  }

  async maybeInitializeDatabase() {
    const { log } = this;
    const { config } = this.app;
    try {
      // Attempt to access the database...
      const connectionOptions =
        this.knexConnectionOptions() as Knex.Knex.Sqlite3ConnectionConfig;
      await fs.access(
        connectionOptions.filename,
        fsConstants.R_OK | fsConstants.W_OK
      );
    } catch (err) {
      // Failed to access database, assume it doesn't exist
      // TODO: check if it's actually a permission problem
      log.warn({ msg: "initializing sqlite database", err });
      await mkdirp(config.get("dataPath"));
      await this.connection.migrate.latest();
    }
  }

  get connection() {
    const { log } = this;
    const { config } = this.app;

    if (this._connection) {
      return this._connection;
    }

    log.trace({ msg: "buildDatabaseConnection" });

    const migrations: Knex.Knex.MigratorConfig = {
      directory: path.resolve(path.join(__dirname, "migrations")),
    };

    const pool: Knex.Knex.PoolConfig = {
      min: 1,
      max: config.get("sqliteDatabaseMaxConnections"),
      // afterCreate: this.connectionAfterCreate.bind(this),
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

  async createHashedPasswordAndSaltForUsernameAndProfileId(
    username: string,
    profileId: string,
    passwordHashed: string,
    salt: string
  ): Promise<string> {
    const id = uuid();
    await this.connection("passwords").insert({
      id,
      username,
      profileId,
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
  ): Promise<
    | undefined
    | { id: string; passwordHashed: string; salt: string; profileId: string }
  > {
    const result = await this.connection("passwords")
      .select("id", "passwordHashed", "salt", "profileId")
      .where("username", username)
      .first();
    if (!result) return;
    const { id, salt, passwordHashed, profileId } = result;
    return {
      id,
      salt,
      passwordHashed,
      profileId,
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

  async upsertBookmark(bookmark: BookmarkCreatable) {
    const now = Date.now();
    const result = await this._upsertOneBookmark(
      bookmark,
      now,
      this.connection
    );
    return result;
  }

  async upsertBookmarksBatch(bookmarks: BookmarkCreatable[]) {
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

  async updateBookmark(bookmarkId: string, updates: BookmarkUpdatable) {
    const now = Date.now();

    const original = await this.fetchBookmark(bookmarkId);
    if (!original) throw new Error("item not found");

    const result = await this.connection("bookmarks")
      .where({ id: bookmarkId })
      .update({
        ...updates,
        modified: now,
        tags: this.serializeTagsColumn(updates.tags),
      });
    if (!result) throw new Error("item update failed");

    // Hacky attempt at an optimistic update
    const resultBookmark = {
      ...original,
      ...updates,
      id: bookmarkId,
      modified: new Date(now),
    };
    return resultBookmark;
  }

  async deleteBookmark(bookmarkId: string) {
    const result = await this.connection("bookmarks")
      .where({ id: bookmarkId })
      .del();
    return result > 0;
  }

  async fetchBookmark(bookmarkId: string): Promise<Bookmark | null> {
    return this._mapRowToBookmark(
      await this.connection("bookmarks")
        .select("*")
        .where({ id: bookmarkId })
        .first()
    );
  }

  async listBookmarksForOwner(
    ownerId: string,
    limit: number,
    offset: number
  ): Promise<{ total: number; items: Bookmark[] }> {
    const query = this.connection("bookmarks").where({ ownerId });
    return this._paginateBookmarksQuery(query, limit, offset);
  }

  async listBookmarksForOwnerByTags(
    ownerId: string,
    tags: string[],
    limit: number,
    offset: number
  ): Promise<{ total: number; items: Bookmark[] }> {
    const query = this.connection("bookmarks").where({ ownerId });
    this._constrainBookmarksQueryByTag(query, tags);
    return this._paginateBookmarksQuery(query, limit, offset);
  }

  async listBookmarksByTags(
    tags: string[],
    limit: number,
    offset: number
  ): Promise<{ total: number; items: Bookmark[] }> {
    const query = this.connection("bookmarks");
    this._constrainBookmarksQueryByTag(query, tags);
    return this._paginateBookmarksQuery(query, limit, offset);
  }

  async listTagsForOwner(
    ownerId: string,
    limit: number,
    offset: number
  ): Promise<TagCount[]> {
    const result = await this.connection.raw(
      `--sql
        select name, count(name) as count
        from tags
        where
          ownerId=?
          and name <> ""
        group by name
        order by count desc
        limit ?
        offset ?
      `,
      [ownerId, limit, offset]
    );
    return result.map(({ name, count }: TagCount) => ({ name, count }));
  }

  async _upsertOneBookmark(
    bookmark: BookmarkCreatable,
    now: number,
    connection: Knex.Knex
  ) {
    const created = bookmark.created || now;
    const modified = bookmark.modified || now;
    const toInsert = {
      ...bookmark,
      tags: this.serializeTagsColumn(bookmark.tags),
      id: uuid(),
      created,
      modified,
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

  serializeTagsColumn(tags: Bookmark["tags"] = []): string {
    const tagItems: TagItem[] = tags.map((tag) => ({
      name: tag,
    }));
    return JSON.stringify(tagItems);
  }

  deserializeTagsColumn(tags: string = ""): Bookmark["tags"] {
    try {
      const tagsItems: TagItem[] = JSON.parse(tags);
      return tagsItems.map(({ name }) => name);
    } catch (err) {
      /* no-op */
    }
    return [];
  }

  serializeMetaColumn(meta = {}) {
    return JSON.stringify(meta);
  }

  deserializeMetaColumn(metaRaw: string = "{}") {
    try {
      return JSON.parse(metaRaw);
    } catch (err) {
      /* no-op */
    }
  }

  _mapRowToBookmark(row: BookmarksRow): Bookmark {
    const { tags = "", created, modified, meta = "{}", ...rest } = row;
    return {
      ...rest,
      meta: this.deserializeMetaColumn(meta),
      tags: this.deserializeTagsColumn(tags),
      created: new Date(created),
      modified: new Date(modified),
    };
  }

  _mapBookmarkToRow(bookmark: Bookmark): BookmarksRow {
    const {
      tags = [],
      created = new Date(),
      modified = new Date(),
      meta = {},
      ...rest
    } = bookmark;
    return {
      ...rest,
      meta: this.serializeMetaColumn(meta),
      tags: this.serializeTagsColumn(tags),
      created: created.getTime(),
      modified: modified.getTime(),
    };
  }

  async _paginateBookmarksQuery(
    baseQuery: Knex.Knex.QueryBuilder,
    limit: number,
    offset: number
  ) {
    const [countResult, itemRows] = await Promise.all([
      baseQuery.clone().count<Record<string, number>>({ count: "*" }).first(),
      await baseQuery
        .clone()
        .orderBy("created", "desc")
        .limit(limit)
        .offset(offset),
    ]);

    if (!countResult) throw new Error("total query failed");

    const total = countResult?.count;
    const items = itemRows.map((item: BookmarksRow) =>
      this._mapRowToBookmark(item)
    );

    return { total, items };
  }

  _constrainBookmarksQueryByTag(query: Knex.Knex.QueryBuilder, tags: string[]) {
    for (const name of tags) {
      query.whereIn("id", function () {
        this.select("bookmarksId").from("tags").where({ name });
      });
    }
  }
}
