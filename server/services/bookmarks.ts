import crypto from "crypto";
import { BaseService } from "./base";
import { parseSince } from "../utils/since";

export type IAppRequirements = {
  repository: IBookmarksRepository;
};

export class BookmarksService extends BaseService<IAppRequirements> {
  async upsert(bookmark: BookmarkCreatable) {
    return await this.app.repository.upsertBookmark({
      uniqueHash: await this.generateUrlHash(bookmark.href),
      ...bookmark,
    });
  }

  async upsertBatch(bookmarks: BookmarkCreatable[]) {
    return await this.app.repository.upsertBookmarksBatch(
      await Promise.all(
        bookmarks.map(async (bookmark) => ({
          uniqueHash: await this.generateUrlHash(bookmark.href),
          ...bookmark,
        }))
      )
    );
  }

  async update(bookmark: BookmarkUpdatable) {
    const uniqueHash =
      bookmark.href && (await this.generateUrlHash(bookmark.href || ""));
    return await this.app.repository.updateBookmark({
      ...bookmark,
      uniqueHash,
    });
  }

  async updateBatch(bookmarks: BookmarkUpdatable[]) {
    return await this.app.repository.updateBookmarksBatch(
      await Promise.all(
        bookmarks.map(async (bookmark) => ({
          uniqueHash:
            bookmark.href && (await this.generateUrlHash(bookmark.href)),
          ...bookmark,
        }))
      )
    );
  }

  async delete(bookmarkId: string) {
    return await this.app.repository.deleteBookmark(bookmarkId);
  }

  async get(
    viewerId: string | undefined,
    bookmarkId: string
  ): Promise<BookmarkWithPermissions | null> {
    return await this.annotateBookmarkWithPermissions(
      viewerId,
      await this.app.repository.fetchBookmark(bookmarkId)
    );
  }

  async getByUrl(
    ownerId: string,
    url: string
  ): Promise<BookmarkWithPermissions | null> {
    return await this.annotateBookmarkWithPermissions(
      ownerId,
      await this.app.repository.fetchBookmarkByOwnerAndUrl(ownerId, url)
    );
  }

  // TODO: merge listForOwner and listForOwnerByTags into a single method?
  async listForOwner(
    viewerId: string | undefined,
    ownerId: string,
    options: BookmarksListOptions
  ) {
    const { total, items } = await this.app.repository.listBookmarksForOwner(
      ownerId,
      this._convertBookmarksListOptions(options)
    );
    return {
      total,
      items: await this.annotateBookmarksWithPermissions(viewerId, items),
    };
  }

  async listForOwnerByTags(
    viewerId: string | undefined,
    ownerId: string,
    tags: string[],
    options: BookmarksListOptions
  ) {
    const { total, items } =
      await this.app.repository.listBookmarksForOwnerByTags(
        ownerId,
        tags,
        this._convertBookmarksListOptions(options)
      );
    return {
      total,
      items: await this.annotateBookmarksWithPermissions(viewerId, items),
    };
  }

  async searchForOwner(
    viewerId: string | undefined,
    ownerId: string,
    query: string,
    tags: string[],
    options: BookmarksListOptions
  ) {
    // TODO: support a search query syntax on specific fields, etc. parse
    // that down to a data structure for the repository to translate into
    // specific DB query logic
    const { total, items } = await this.app.repository.searchBookmarksForOwner(
      ownerId,
      query,
      tags,
      this._convertBookmarksListOptions(options)
    );
    return {
      total,
      items: await this.annotateBookmarksWithPermissions(viewerId, items),
    };
  }

  async listByTags(
    viewerId: string | undefined,
    tags: string[],
    options: BookmarksListOptions
  ) {
    const { total, items } = await this.app.repository.listBookmarksByTags(
      tags,
      this._convertBookmarksListOptions(options)
    );
    return {
      total,
      items: await this.annotateBookmarksWithPermissions(viewerId, items),
    };
  }

  _convertBookmarksListOptions(
    options: BookmarksListOptions
  ): BookmarksRepositoryListOptions {
    const { limit, offset, order, since } = options;
    return { limit, offset, order, since: parseSince(since) };
  }

  async listTagsForOwner(ownerId: string, limit: number, offset: number) {
    return await this.app.repository.listTagsForOwner(ownerId, limit, offset);
  }

  async permissionsForBookmark(
    viewerId: string | undefined,
    bookmark: Bookmark
  ): Promise<BookmarkPermissions> {
    return {
      viewerId,
      canEdit: bookmark.ownerId === viewerId,
      canView: true, // todo: viaibility property check
    };
  }

  async annotateBookmarkWithPermissions(
    viewerId: string | undefined,
    bookmark: Bookmark | null
  ) {
    return !bookmark
      ? null
      : {
          ...bookmark,
          ...(await this.permissionsForBookmark(viewerId, bookmark)),
        };
  }

  async annotateBookmarksWithPermissions(
    viewerId: string | undefined,
    bookmarks: Bookmark[]
  ) {
    const out: BookmarkWithPermissions[] = [];
    for (const bookmark of bookmarks) {
      const annotated = await this.annotateBookmarkWithPermissions(
        viewerId,
        bookmark
      );
      if (annotated) out.push(annotated);
    }
    return out;
  }

  formFieldToTags(tags: string = ""): Bookmark["tags"] {
    return tags.split(/ +/g).filter((t) => !!t);
  }

  tagsToFormField(tags: Bookmark["tags"] = []): string {
    return tags.join(" ");
  }

  /**
   * Normalize a URL for hashing - note that this is destructive
   * and shouldn't be stored as a substitute for user input.
   */
  async normalizeUrlForHash(urlRaw: string) {
    try {
      const url = new URL(urlRaw);

      // alphabetize query param keys
      url.searchParams.sort();

      // strip trailing slash from URL path
      url.pathname = url.pathname.replace(/\/$/, "");

      // strip out parameters starting with utm_
      for (const key of url.searchParams.keys()) {
        if (key.startsWith("utm_")) {
          url.searchParams.delete(key);
        }
      }

      // TODO: find more parameters to strip out

      return url.toString();
    } catch (err) {
      this.log.warn({ msg: "failed to normalize URL", urlRaw, err });
      return urlRaw;
    }
  }

  async generateUrlHash(urlOrig: string, normalize: boolean = true) {
    const urlToHash = normalize
      ? await this.normalizeUrlForHash(urlOrig)
      : urlOrig;
    return crypto.createHash("sha256").update(urlToHash).digest("hex");
  }
}

export type Bookmark = {
  id: string;
  ownerId: string;
  uniqueHash: string;
  href: string;
  title: string;
  extended?: string;
  tags?: string[];
  visibility?: string;
  meta?: Record<string, any>;
  created?: Date;
  modified?: Date;
};

export type BookmarkCreatable = Omit<Bookmark, "id" | "uniqueHash">;

export type BookmarkCreatableWithHash = Omit<Bookmark, "id">;

export type BookmarkUpdatable = Pick<Bookmark, "id"> &
  Omit<Partial<Bookmark>, "id" | "ownerId" | "uniqueHash">;

export type BookmarkUpdatableWithHash = Pick<Bookmark, "id"> &
  Omit<Partial<Bookmark>, "id" | "ownerId">;

export type BookmarkPermissions = {
  viewerId: string | undefined;
  canEdit: boolean;
  canView: boolean;
};

export type BookmarkWithPermissions = Bookmark & BookmarkPermissions;

export type TagCount = {
  name: string;
  count: number;
};

export interface IBookmarksRepository {
  upsertBookmark(bookmark: BookmarkCreatableWithHash): Promise<Bookmark>;
  upsertBookmarksBatch(
    bookmarks: BookmarkCreatableWithHash[]
  ): Promise<Bookmark[]>;
  updateBookmark(bookmark: BookmarkUpdatableWithHash): Promise<Bookmark>;
  updateBookmarksBatch(
    bookmark: BookmarkUpdatableWithHash[]
  ): Promise<Partial<Bookmark>[]>;
  deleteBookmark(bookmarkId: string): Promise<boolean>;
  fetchBookmark(bookmarkId: string): Promise<Bookmark | null>;
  fetchBookmarkByOwnerAndUrl(
    ownerId: string,
    url: string
  ): Promise<Bookmark | null>;
  listBookmarksForOwner(
    ownerId: string,
    options: BookmarksRepositoryListOptions
  ): Promise<{ total: number; items: Bookmark[] }>;
  listBookmarksForOwnerByTags(
    ownerId: string,
    tags: string[],
    options: BookmarksRepositoryListOptions
  ): Promise<{ total: number; items: Bookmark[] }>;
  searchBookmarksForOwner(
    ownerId: string,
    query: string,
    tags: string[],
    options: BookmarksRepositoryListOptions
  ): Promise<{ total: number; items: Bookmark[] }>;
  listBookmarksByTags(
    tags: string[],
    options: BookmarksRepositoryListOptions
  ): Promise<{ total: number; items: Bookmark[] }>;
  listTagsForOwner(
    ownerId: string,
    limit: number,
    offset: number
  ): Promise<TagCount[]>;
}

export interface BookmarksListOptions {
  limit: number;
  offset: number;
  order?: string;
  since?: string;
}

export interface BookmarksRepositoryListOptions {
  limit: number;
  offset: number;
  order?: string;
  since?: Date;
}
