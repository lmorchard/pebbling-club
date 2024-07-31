import { CliAppModule } from "../app/modules";

export interface BaseRepository extends CliAppModule {
  listAllUsers(): Promise<{
    id: string;
    username: string;
    passwordHashed: string;
    salt: string;
  }[]>;

  createHashedPasswordAndSaltForUsername(
    username: string,
    passwordHashed: string,
    salt: string
  ): Promise<string>;

  updateHashedPasswordAndSaltForUsername(
    username: string,
    passwordHashed: string,
    salt: string
  ): Promise<number>;

  getHashedPasswordAndSaltForUsername(
    username: string
  ): Promise<undefined | { id: string; hashedPassword: string; salt: string }>;

  checkIfUsernameExists(username: string): Promise<boolean>;

  getUsernameById(id: string): Promise<undefined | string>;

  getIdByUsername(username: string): Promise<undefined | string>;

  deleteHashedPasswordAndSaltForUsername(
    username: string
  ): Promise<string>;

  deleteSession(sid: string): void;

  deleteExpiredSessions(maxAge: number): void;

  getSession(sid: string): Promise<undefined | { session: string }>;

  putSession(sid: string, sess: string, expiredDate: Date): Promise<void>;

  upsertBookmark(bookmark: BookmarkEditable): Promise<void>;

  upsertBookmarksBatch(bookmarks: BookmarkEditable[]): Promise<void>;
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
