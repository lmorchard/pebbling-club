import { BaseService } from "./base";

export class BookmarksService extends BaseService {
  async create(bookmark: BookmarkEditable) {
    await this.app.repository.upsertBookmark(bookmark);
  }

  async createBatch(bookmarks: BookmarkEditable[]) {
    await this.app.repository.upsertBookmarksBatch(bookmarks);
  }

  async listForOwner(ownerId: string, limit: number) {
    this.log.debug({ msg: "listForOwner", ownerId, limit });
    return await this.app.repository.listBookmarksForOwner(ownerId, limit);
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