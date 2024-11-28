import Knex from "knex";
import { v4 as uuid } from "uuid";
import parseDuration from "parse-duration";
import { IKnexConnectionOptions, IKnexRepository } from "../../knex";
import {
  Bookmark,
  IBookmarksRepository,
  BookmarksListOptions,
  TagCount,
  BookmarkCreatableWithHash,
  BookmarkUpdatableWithHash,
  BookmarksRepositoryListOptions,
} from "../../../services/bookmarks";
import {
  Profile,
  ProfileEditable,
  IProfilesRepository,
} from "../../../services/profiles";
import { IPasswordsRepository } from "../../../services/passwords";
import FeedsRepository from "../feeds";
import BaseSqliteKnexRepository from "../base";

export const configSchema = {
  sqliteDatabasePath: {
    doc: "Data directory for sqlite3 database",
    env: "SQLITE_DATA_PATH",
    format: String,
    default: "data" as string,
  },
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
  sqliteDatabaseMmapSize: {
    doc: "sqlite mmap_size pragma",
    env: "SQLITE_MMAP_SIZE",
    format: Number,
    default: 268435456,
  },
} as const;

// TODO: derive type from table?
export type BookmarksRow = {
  id: string;
  ownerId: string;
  uniqueHash: string;
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

type IAppRequirements = {
  feedsRepository?: FeedsRepository;
};

export class SqliteRepository
  extends BaseSqliteKnexRepository<IAppRequirements>
  implements
    IBookmarksRepository,
    IPasswordsRepository,
    IProfilesRepository,
    IKnexRepository,
    IKnexConnectionOptions
{
  get migrationsDirectory() {
    return this._resolveMigrationsDirectory("main");
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
    await this.enqueue(() =>
      this.connection("passwords").insert({
        id,
        username,
        profileId,
        passwordHashed,
        salt,
      })
    );
    return id;
  }

  async updateHashedPasswordAndSaltForUsername(
    username: string,
    passwordHashed: string,
    salt: string
  ) {
    return await this.enqueue(() =>
      this.connection("passwords").where("username", username).update({
        username,
        passwordHashed,
        salt,
      })
    );
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
    return this.enqueue(() =>
      this.connection("passwords").where("id", id).del()
    );
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
    await this.enqueue(() =>
      this.connection("profiles").insert({
        ...profile,
        id,
        created: profile.created?.getTime() || now,
        modified: profile.modified?.getTime() || now,
      })
    );
    return id;
  }

  async updateProfile(id: string, profile: ProfileEditable): Promise<void> {
    await this.enqueue(() =>
      this.connection("profiles")
        .where({ id })
        .update({
          ...profile,
          modified: Date.now(),
        })
    );
  }

  async getProfile(id: string): Promise<Profile> {
    return this.connection("profiles").where({ id }).first();
  }

  async getProfileByUsername(username: string): Promise<Profile> {
    return this.connection("profiles").where({ username }).first();
  }

  async deleteProfile(id: string): Promise<void> {
    return this.enqueue(() => this.connection("profiles").where({ id }).del());
  }

  async upsertBookmark(bookmark: BookmarkCreatableWithHash) {
    const now = Date.now();
    const result = await this.enqueue(() =>
      this._upsertOneBookmark(bookmark, now, this.connection)
    );
    return result;
  }

  async upsertBookmarksBatch(bookmarks: BookmarkCreatableWithHash[]) {
    const now = Date.now();
    const results: Bookmark[] = [];
    await this.enqueue(() =>
      this.connection.transaction(async (trx) => {
        for (const bookmark of bookmarks) {
          const result = await this._upsertOneBookmark(bookmark, now, trx);
          results.push(result);
        }
      })
    );
    return results;
  }

  async _upsertOneBookmark(
    bookmark: BookmarkCreatableWithHash,
    now: number,
    connection: Knex.Knex
  ): Promise<Bookmark> {
    const upsertColumns = [
      "uniqueHash",
      "ownerId",
      "href",
      "title",
      "extended",
      "tags",
      "visibility",
      "meta",
      "created",
      "modified",
    ] as const;

    const extracted = upsertColumns.reduce(
      (acc, key) => ({ ...acc, [key]: bookmark[key] }),
      {}
    ) as BookmarkCreatableWithHash;

    const toUpsert = {
      id: uuid(),
      ...extracted,
      created: extracted.created || now,
      modified: extracted.modified || now,
      tags: bookmark.tags && this.serializeTagsColumn(bookmark.tags),
      meta: bookmark.meta && this.serializeMetaColumn(bookmark.meta),
    };

    const result = await connection("bookmarks")
      .insert(toUpsert)
      .onConflict(["ownerId", "uniqueHash"])
      .merge({
        ...toUpsert,
        meta:
          bookmark.meta &&
          connection.raw(`
          json_patch(
            iif(json_valid(meta), meta, "{}"),
            excluded.meta
          )
        `),
      });

    // Hacky attempt at an optimistic update, will probably mismatch a
    // few fields like created if they're not supplied in the original
    const resultBookmark: Bookmark = {
      ...extracted,
      tags: bookmark.tags,
      meta: bookmark.meta,
      id: toUpsert.id,
      created: new Date(toUpsert.created),
      modified: new Date(toUpsert.modified),
    };

    return resultBookmark;
  }

  async updateBookmark(bookmark: BookmarkUpdatableWithHash): Promise<Bookmark> {
    const now = Date.now();

    const original = await this.fetchBookmark(bookmark.id);
    if (!original) throw new Error("item not found");

    const result = await this.enqueue(() =>
      this._updateOneBookmark(bookmark, original, now, this.connection)
    );
    // TODO: this is ugly because I'm lazy and updateBookmarksBatch returns partial, but this method actually does return Bookmark
    return result as Bookmark;
  }

  async updateBookmarksBatch(
    bookmarks: BookmarkUpdatableWithHash[]
  ): Promise<Partial<Bookmark>[]> {
    // TODO: do a batch fetch of bookmarks to be updated to support returning optimistic updates?
    const now = Date.now();
    const results: Partial<Bookmark>[] = [];
    await this.enqueue(() =>
      this.connection.transaction(async (trx) => {
        for (const bookmark of bookmarks) {
          const result = await this._updateOneBookmark(
            bookmark,
            undefined,
            now,
            trx
          );
          results.push(result);
        }
      })
    );
    return results;
  }

  async _updateOneBookmark(
    bookmark: BookmarkUpdatableWithHash,
    original: Bookmark | undefined,
    now: number,
    connection: Knex.Knex
  ): Promise<Partial<Bookmark>> {
    const updateColumns = [
      "uniqueHash",
      "href",
      "title",
      "extended",
      "visibility",
      "tags",
      "meta",
    ] as const;
    const updates: BookmarkUpdatableWithHash = {
      id: bookmark.id,
      ...updateColumns
        .filter(
          (key) => key in bookmark && typeof bookmark[key] !== "undefined"
        )
        .reduce((acc, key) => ({ ...acc, [key]: bookmark[key] }), {}),
    };

    const result = await connection("bookmarks")
      .where({ id: updates.id })
      .update({
        ...updates,
        modified: now,
        tags: updates.tags && this.serializeTagsColumn(updates.tags),
        meta:
          updates.meta &&
          this.connection.raw(
            `
          json_patch(
            iif(json_valid(meta), meta, "{}"),
            ?
          )
        `,
            this.serializeMetaColumn(updates.meta)
          ),
      });
    if (!result) throw new Error("item update failed");

    // Hacky attempt at an optimistic update
    const resultBookmark = {
      ...(original || {}),
      ...updates,
      modified: new Date(now),
    };
    return resultBookmark;
  }

  async deleteBookmark(bookmarkId: string) {
    const result = await this.enqueue(() =>
      this.connection("bookmarks").where({ id: bookmarkId }).del()
    );
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

  async fetchBookmarkByOwnerAndUrl(
    ownerId: string,
    url: string
  ): Promise<Bookmark | null> {
    return this._mapRowToBookmark(
      await this.connection("bookmarks")
        .select("*")
        .where({ ownerId, href: url })
        .first()
    );
  }

  async listBookmarksForOwner(
    ownerId: string,
    options: BookmarksRepositoryListOptions
  ): Promise<{ total: number; items: Bookmark[] }> {
    return this._listBookmarks(options, async (query) => {
      query.where({ ownerId });
    });
  }

  async listBookmarksForOwnerByTags(
    ownerId: string,
    tags: string[],
    options: BookmarksRepositoryListOptions
  ): Promise<{ total: number; items: Bookmark[] }> {
    return this._listBookmarks(options, async (query) => {
      query.where({ ownerId });
      this._constrainBookmarksQueryByTag(query, tags);
    });
  }

  async listBookmarksByTags(
    tags: string[],
    options: BookmarksRepositoryListOptions
  ): Promise<{ total: number; items: Bookmark[] }> {
    return this._listBookmarks(options, async (query) => {
      this._constrainBookmarksQueryByTag(query, tags);
    });
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

  serializeTagsColumn(tags: Bookmark["tags"] = []): string {
    const uniqueTags = Array.from(new Set(tags));
    const tagItems: TagItem[] = uniqueTags.map((tag) => ({
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

  async _listBookmarks(
    options: BookmarksRepositoryListOptions,
    modifierFn: (query: Knex.Knex.QueryBuilder) => Promise<void>
  ): Promise<{ total: number; items: Bookmark[] }> {
    const { limit, offset, order, since } = options;

    if (order === "feed") await this._attachFeedsDatabase();

    const query = this._baseListBookmarksQuery();
    await modifierFn(query);
    await this._constrainBoomarksQueryByDate(query, order, since);
    await this._orderBookmarksQuery(query, order);
    const result = await this._paginateBookmarksQuery(query, limit, offset);

    if (order === "feed") await this._detachFeedsDatabase();

    return result;
  }

  async _constrainBoomarksQueryByDate(
    query: Knex.Knex.QueryBuilder,
    order?: string,
    sinceDate?: Date
  ) {
    if (!sinceDate) return;

    // TODO: these differences in date format is annoying :(
    // TODO: separate these into distinct parameters
    if (order === "feed") {
      query.where(
        "FeedsDB.Feeds.newestItemDate",
        ">",
        sinceDate?.toISOString()
      );
    } else {
      query.where("bookmarks.modified", ">", sinceDate?.getTime());
    }
  }

  _baseListBookmarksQuery(): Knex.Knex.QueryBuilder {
    return this.connection("bookmarks").select("bookmarks.*");
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
      query.whereIn("bookmarks.id", function () {
        this.select("bookmarksId").from("tags").where({ name });
      });
    }
  }

  async _orderBookmarksQuery(query: Knex.Knex.QueryBuilder, order?: string) {
    if (order === "feed" && this.app.feedsRepository) {
      query
        .joinRaw(
          `
            LEFT JOIN FeedsDB.Feeds
            ON FeedsDB.Feeds.url = bookmarks.feedUrl
          `
        )
        .orderBy("FeedsDB.Feeds.newestItemDate", "desc");
    }
  }

  async _attachFeedsDatabase() {
    const { log } = this;
    const { feedsRepository } = this.app;
    if (!feedsRepository) return;

    // HACK: Knex doesn't export Sqlite3ConnectionConfig type?
    const { filename } = feedsRepository!.knexConnectionOptions() as {
      filename: string;
    };
    await this.connection.raw(`ATTACH DATABASE ? AS FeedsDB`, filename);
    log.trace({ msg: "attached feeds database" });
  }

  async _detachFeedsDatabase() {
    const { log } = this;
    const { feedsRepository } = this.app;
    if (!feedsRepository) return;

    await this.connection.raw(`DETACH DATABASE FeedsDB`);
    log.trace({ msg: "detached feeds database" });
  }

  _mapRowToBookmark(row: BookmarksRow | null): Bookmark | null {
    if (!row) return null;
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
}
