import Knex from "knex";
import { v4 as uuid } from "uuid";
import { IKnexConnectionOptions, IKnexRepository } from "../../knex";
import {
  Bookmark,
  BookmarkUpdatable,
  BookmarkCreatable,
  IBookmarksRepository,
  TagCount,
  BookmarkCreatableWithHash,
  BookmarkUpdatableWithHash,
} from "../../../services/bookmarks";
import {
  Profile,
  ProfileEditable,
  IProfilesRepository,
} from "../../../services/profiles";
import { IPasswordsRepository } from "../../../services/passwords";
import BaseSqliteKnexRepository from "../base";
import path from "path";

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

export class SqliteRepository
  extends BaseSqliteKnexRepository
  implements
    IBookmarksRepository,
    IPasswordsRepository,
    IProfilesRepository,
    IKnexRepository,
    IKnexConnectionOptions
{
  get migrationsDirectory() {
    return path.resolve(path.join(__dirname, "migrations"));
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

  async upsertBookmark(bookmark: BookmarkCreatableWithHash) {
    const now = Date.now();
    const result = await this._upsertOneBookmark(
      bookmark,
      now,
      this.connection
    );
    return result;
  }

  async upsertBookmarksBatch(bookmarks: BookmarkCreatableWithHash[]) {
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
        meta: bookmark.meta && connection.raw(`
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

  async updateBookmark(
    bookmarkId: string,
    bookmark: BookmarkUpdatableWithHash
  ) {
    const now = Date.now();

    const original = await this.fetchBookmark(bookmarkId);
    if (!original) throw new Error("item not found");

    const updateColumns = [
      "uniqueHash",
      "href",
      "title",
      "extended",
      "visibility",
      "tags",
      "meta",
    ] as const;
    const updates: BookmarkUpdatableWithHash = updateColumns
      .filter((key) => key in bookmark && typeof bookmark[key] !== "undefined")
      .reduce((acc, key) => ({ ...acc, [key]: bookmark[key] }), {});

    const result = await this.connection("bookmarks")
      .where({ id: bookmarkId })
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
