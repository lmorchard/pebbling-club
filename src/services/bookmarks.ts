import { IApp } from "../app/types";
import { BaseService } from "./base";

export class BookmarksService extends BaseService {
  repository: IBookmarksRepository;

  constructor(app: IApp, repository: IBookmarksRepository) {
    super(app);
    this.repository = repository;
  }

  async create(bookmark: BookmarkEditable) {
    await this.repository.upsertBookmark(bookmark);
  }

  async createBatch(bookmarks: BookmarkEditable[]) {
    await this.repository.upsertBookmarksBatch(bookmarks);
  }

  async listForOwner(ownerId: string, limit: number) {
    this.log.debug({ msg: "listForOwner", ownerId, limit });
    return await this.repository.listBookmarksForOwner(ownerId, limit);
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
  upsertBookmark(bookmark: BookmarkEditable): Promise<void>;
  upsertBookmarksBatch(bookmarks: BookmarkEditable[]): Promise<void>;
  listBookmarksForOwner(ownerId: string, limit: number): Promise<Bookmark[]>;
}
