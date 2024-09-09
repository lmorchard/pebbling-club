import { IApp } from "../app/types";
import { BaseService } from "./base";

export class BookmarksService extends BaseService {
  repository: IBookmarksRepository;

  constructor(app: IApp, repository: IBookmarksRepository) {
    super(app);
    this.repository = repository;
  }

  async upsert(bookmark: BookmarkCreatable) {
    return await this.repository.upsertBookmark(bookmark);
  }

  async upsertBatch(bookmarks: BookmarkCreatable[]) {
    return await this.repository.upsertBookmarksBatch(bookmarks);
  }

  async update(bookmarkId: string, bookmark: BookmarkUpdatable) {
    return await this.repository.updateBookmark(bookmarkId, { ...bookmark });
  }

  async delete(bookmarkId: string) {
    return await this.repository.deleteBookmark(bookmarkId);
  }

  async get(
    viewerId: string | undefined,
    bookmarkId: string
  ): Promise<BookmarkWithPermissions | null> {
    return await this.annotateBookmarkWithPermissions(
      viewerId,
      await this.repository.fetchBookmark(bookmarkId)
    );
  }

  async getByUrl(
    ownerId: string,
    url: string
  ): Promise<BookmarkWithPermissions | null> {
    return await this.annotateBookmarkWithPermissions(
      ownerId,
      await this.repository.fetchBookmarkByOwnerAndUrl(ownerId, url)
    );
  }

  async listForOwner(
    viewerId: string | undefined,
    ownerId: string,
    limit: number,
    offset: number
  ) {
    const { total, items } = await this.repository.listBookmarksForOwner(
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
    const { total, items } = await this.repository.listBookmarksForOwnerByTags(
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
    const { total, items } = await this.repository.listBookmarksByTags(
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
    return await this.repository.listTagsForOwner(ownerId, limit, offset);
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
}

export type Bookmark = {
  id: string;
  ownerId: string;
  href: string;
  title: string;
  extended?: string;
  tags?: string[];
  visibility?: string;
  meta?: Record<string, any>;
  created?: Date;
  modified?: Date;
};

export type BookmarkCreatable = Omit<Bookmark, "id">;

export type BookmarkUpdatable = Omit<Partial<Bookmark>, "id" | "ownerId">;

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
  upsertBookmark(bookmark: BookmarkCreatable): Promise<Bookmark>;
  upsertBookmarksBatch(bookmarks: BookmarkCreatable[]): Promise<Bookmark[]>;
  updateBookmark(
    bookmarkId: string,
    bookmark: BookmarkUpdatable
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
  },
} as const;

export const NewBookmarkSchema = {
  type: "object",
  properties: {
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
    visibility: {
      type: "string",
      enum: ["public", "private"],
      errorMessage: {
        enum: "Invalid visibility",
      },
    },
  },
} as const;
