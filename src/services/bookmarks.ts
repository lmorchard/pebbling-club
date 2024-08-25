import { IApp } from "../app/types";
import { BaseService } from "./base";

export type Bookmark = {
  id: string;
  ownerId: string;
  href: string;
  title: string;
  extended?: string;
  tags?: string[];
  visibility?: string;
  meta?: object;
  created?: Date;
  modified?: Date;
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
}

export class BookmarksService extends BaseService {
  repository: IBookmarksRepository;

  constructor(app: IApp, repository: IBookmarksRepository) {
    super(app);
    this.repository = repository;
  }

  async get(bookmarkId: string): Promise<Bookmark | null> {
    return await this.repository.fetchBookmark(bookmarkId);
  }

  async create(bookmark: BookmarkCreatable) {
    return await this.repository.upsertBookmark(bookmark);
  }

  async createBatch(bookmarks: BookmarkCreatable[]) {
    return await this.repository.upsertBookmarksBatch(bookmarks);
  }

  async update(
    bookmarkId: string,
    bookmark: BookmarkUpdatable
  ): Promise<Bookmark> {
    return await this.repository.updateBookmark(bookmarkId, { ...bookmark });
  }

  async delete(bookmarkId: string): Promise<boolean> {
    return await this.repository.deleteBookmark(bookmarkId);
  }

  async listForOwner(
    ownerId: string,
    limit: number,
    offset: number
  ): Promise<{ total: number; items: Bookmark[] }> {
    return await this.repository.listBookmarksForOwner(ownerId, limit, offset);
  }

  async listForOwnerByTags(
    ownerId: string,
    tags: string[],
    limit: number,
    offset: number
  ): Promise<{ total: number; items: Bookmark[] }> {
    return await this.repository.listBookmarksForOwnerByTags(
      ownerId,
      tags,
      limit,
      offset
    );
  }

  async listByTags(
    tags: string[],
    limit: number,
    offset: number
  ): Promise<{ total: number; items: Bookmark[] }> {
    return await this.repository.listBookmarksByTags(
      tags,
      limit,
      offset
    );
  }

  formFieldToTags(tags: string = ""): Bookmark["tags"] {
    return tags.split(/ +/g).filter((t) => !!t);
  }

  tagsToFormField(tags: Bookmark["tags"] = []): string {
    return tags.join(" ");
  }
}

export type BookmarkCreatable = Omit<Bookmark, "id">;

export type BookmarkUpdatable = Omit<Partial<Bookmark>, "id" | "ownerId">;

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
