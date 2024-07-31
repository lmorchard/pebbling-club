import { CliAppModule } from "../app/modules";

export class BaseRepositoryMethodUnimplementedError extends Error {}

export class BaseRepository extends CliAppModule {
  async listAllUsers(): Promise<{
    id: string;
    username: string;
    passwordHashed: string;
    salt: string;
  }[]> {
    throw new BaseRepositoryMethodUnimplementedError();
  }

  async createHashedPasswordAndSaltForUsername(
    username: string,
    passwordHashed: string,
    salt: string
  ): Promise<string> {
    throw new BaseRepositoryMethodUnimplementedError();
  }

  async updateHashedPasswordAndSaltForUsername(
    username: string,
    passwordHashed: string,
    salt: string
  ): Promise<number> {
    throw new BaseRepositoryMethodUnimplementedError();
  }

  async getHashedPasswordAndSaltForUsername(
    username: string
  ): Promise<undefined | { id: string; hashedPassword: string; salt: string }> {
    throw new BaseRepositoryMethodUnimplementedError();
  }
  
  async checkIfUsernameExists(username: string): Promise<boolean> {
    throw new BaseRepositoryMethodUnimplementedError();
  }

  async getUsernameById(id: string): Promise<undefined | string> {
    throw new BaseRepositoryMethodUnimplementedError();
  }

  async getIdByUsername(username: string): Promise<undefined | string> {
    throw new BaseRepositoryMethodUnimplementedError();
  }

  async deleteHashedPasswordAndSaltForUsername(
    username: string
  ): Promise<string> {
    throw new BaseRepositoryMethodUnimplementedError();
  }

  async deleteSession(sid: string) {
    throw new BaseRepositoryMethodUnimplementedError();
  }

  async deleteExpiredSessions(maxAge: number) {
    throw new BaseRepositoryMethodUnimplementedError();
  }

  async getSession(sid: string): Promise<undefined | { session: string }> {
    throw new BaseRepositoryMethodUnimplementedError();
  }

  async putSession(sid: string, sess: string, expiredDate: Date) {
    throw new BaseRepositoryMethodUnimplementedError();
  }

  async upsertBookmark(bookmark: BookmarkEditable) {
    throw new BaseRepositoryMethodUnimplementedError();
  }

  async upsertBookmarksBatch(bookmarks: BookmarkEditable[]) {
    throw new BaseRepositoryMethodUnimplementedError();
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
