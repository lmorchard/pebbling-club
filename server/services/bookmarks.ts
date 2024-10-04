import crypto from "crypto";
import { BaseService } from "./base";

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

  async update(bookmarkId: string, bookmark: BookmarkUpdatable) {
    const { href, title, extended, tags, visibility, meta, created, modified } =
      bookmark;
    const uniqueHash = href && await this.generateUrlHash(href || "");
    return await this.app.repository.updateBookmark(bookmarkId, {
      uniqueHash,
      href,
      title,
      extended,
      tags,
      visibility,
      meta,
      created,
      modified,
    });
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

  async listForOwner(
    viewerId: string | undefined,
    ownerId: string,
    limit: number,
    offset: number
  ) {
    const { total, items } = await this.app.repository.listBookmarksForOwner(
      ownerId,
      limit,
      offset
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
    limit: number,
    offset: number
  ) {
    const { total, items } =
      await this.app.repository.listBookmarksForOwnerByTags(
        ownerId,
        tags,
        limit,
        offset
      );
    return {
      total,
      items: await this.annotateBookmarksWithPermissions(viewerId, items),
    };
  }

  async listByTags(
    viewerId: string | undefined,
    tags: string[],
    limit: number,
    offset: number
  ) {
    const { total, items } = await this.app.repository.listBookmarksByTags(
      tags,
      limit,
      offset
    );
    return {
      total,
      items: await this.annotateBookmarksWithPermissions(viewerId, items),
    };
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

export type BookmarkUpdatable = Omit<
  Partial<Bookmark>,
  "id" | "ownerId" | "unqueHash"
>;

export type BookmarkUpdatableWithHash = Omit<
  Partial<Bookmark>,
  "id" | "ownerId"
>;

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
  updateBookmark(
    bookmarkId: string,
    bookmark: BookmarkUpdatableWithHash
  ): Promise<Bookmark>;
  deleteBookmark(bookmarkId: string): Promise<boolean>;
  fetchBookmark(bookmarkId: string): Promise<Bookmark | null>;
  fetchBookmarkByOwnerAndUrl(
    ownerId: string,
    url: string
  ): Promise<Bookmark | null>;
  listBookmarksForOwner(
    ownerId: string,
    limit: number,
    offset: number
  ): Promise<{ total: number; items: Bookmark[] }>;
  listBookmarksForOwnerByTags(
    ownerId: string,
    tags: string[],
    limit: number,
    offset: number
  ): Promise<{ total: number; items: Bookmark[] }>;
  listBookmarksByTags(
    tags: string[],
    limit: number,
    offset: number
  ): Promise<{ total: number; items: Bookmark[] }>;
  listTagsForOwner(
    ownerId: string,
    limit: number,
    offset: number
  ): Promise<TagCount[]>;
}

export const NewBookmarkQuerystringSchema = {
  type: "object",
  properties: {
    href: {
      type: "string",
    },
    title: {
      type: "string",
    },
    extended: {
      type: "string",
    },
    tags: {
      type: "string",
    },
    next: {
      type: "string",
    },
  },
} as const;

export const NewBookmarkSchema = {
  type: "object",
  properties: {
    next: {
      type: "string",
    },
    href: {
      type: "string",
      minLength: 1,
      errorMessage: {
        type: "URL required",
        minLength: "URL required",
      },
    },
    title: {
      type: "string",
      minLength: 1,
      errorMessage: {
        type: "Title required",
        minLength: "Title required",
      },
    },
    extended: {
      type: "string",
    },
    tags: {
      type: "string",
    },
    unfurl: {
      type: "string",
    },
    visibility: {
      type: "string",
      enum: ["public", "private"],
      errorMessage: {
        enum: "Invalid visibility",
      },
    },
  },
} as const;
