import { CliAppModule } from "../app/modules";
import { Bookmark, BookmarkEditable } from "../services/bookmarks";
import { Profile, ProfileEditable } from "../services/profiles";

export interface BaseRepository extends CliAppModule {
  listAllUsers(): Promise<
    {
      id: string;
      username: string;
      passwordHashed: string;
      salt: string;
    }[]
  >;

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

  checkIfPasswordExistsForUsername(username: string): Promise<boolean>;

  getUsernameById(id: string): Promise<undefined | string>;

  getIdByUsername(username: string): Promise<undefined | string>;

  deleteHashedPasswordAndSaltForId(username: string): Promise<string>;

  deleteSession(sid: string): void;

  deleteExpiredSessions(maxAge: number): void;

  getSession(sid: string): Promise<undefined | { session: string }>;

  putSession(sid: string, sess: string, expiredDate: Date): Promise<void>;

  upsertBookmark(bookmark: BookmarkEditable): Promise<void>;

  upsertBookmarksBatch(bookmarks: BookmarkEditable[]): Promise<void>;

  listBookmarksForOwner(ownerId: string, limit: number): Promise<Bookmark[]>;

  checkIfProfileExistsForUsername(username: string): Promise<boolean>;

  createProfile(profile: Profile): Promise<string>;

  updateProfile(id: string, profile: ProfileEditable): Promise<void>;

  getProfile(id: string): Promise<Profile>;

  getProfileByUsername(username: string): Promise<Profile>;

  deleteProfile(id: string): Promise<void>;
}
