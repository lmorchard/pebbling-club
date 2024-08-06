import { IApp } from "../app/types";
import { BaseService } from "./base";

export class BookmarksService extends BaseService {
  repository: IBookmarksRepository;

  constructor(app: IApp, repository: IBookmarksRepository) {
    super(app);
    this.repository = repository;
  }

  async get(bookmarkId: string): Promise<Bookmark | null> {
    return await this.repository.fetchBookmark(bookmarkId);
  }

  async create(bookmark: BookmarkEditable) {
    return await this.repository.upsertBookmark(bookmark);
  }

  async createBatch(bookmarks: BookmarkEditable[]) {
    return await this.repository.upsertBookmarksBatch(bookmarks);
  }

  async update(bookmarkId: string, bookmark: BookmarkEditable): Promise<Bookmark>{
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
}

export type Bookmark = {
  id: string;
  ownerId: string;
  href: string;
  title?: string;
  extended?: string;
  tags?: string;
  visibility?: string;
  meta?: string;
  created?: Date;
  modified?: Date;
};

export type BookmarkEditable = Omit<Bookmark, "id">;

export interface IBookmarksRepository {
  upsertBookmark(bookmark: BookmarkEditable): Promise<Bookmark>;
  upsertBookmarksBatch(bookmarks: BookmarkEditable[]): Promise<Bookmark[]>;
  updateBookmark(bookmarkId: string, bookmark: BookmarkEditable): Promise<Bookmark>;
  fetchBookmark(bookmarkId: string): Promise<Bookmark | null>;
  deleteBookmark(bookmarkId: string): Promise<boolean>;
  listBookmarksForOwner(
    ownerId: string,
    limit: number,
    offset: number
  ): Promise<{ total: number; items: Bookmark[] }>;
}
