import crypto from "crypto";
import { BaseRepository } from "../repositories/base";
import { BaseService } from "./base";

export class BookmarksService extends BaseService {

  async create(bookmark: BookmarkEditable) {

  }

  async createBatch(bookmarks: BookmarkEditable[]) {
    await this.repository.upsertBookmarksBatch(bookmarks);
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
  created: Date;
  modified: Date;
};

export type BookmarkEditable = Omit<Bookmark, "id" | "created" | "modified">;
