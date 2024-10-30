import { rimraf } from "rimraf";
import { Readable } from "stream";
import { BaseApp } from "../app";
import { IApp } from "../app/types";
import { SqliteRepository } from "../repositories/sqlite/main";
import { BookmarksService, IBookmarksRepository } from "../services/bookmarks";
import { ImportService } from "../services/imports";
import { PasswordService, IPasswordsRepository } from "../services/passwords";
import { ProfileService, IProfilesRepository } from "../services/profiles";
import { FetchResponseFromCache, FetchService } from "../services/fetch";
import BodyReadable from "undici/types/readable.js";
// @ts-ignore
import { Readable as BodyReadableImpl } from "undici/lib/api/readable.js";

export class TestApp extends BaseApp implements IApp {
  repository: IPasswordsRepository & IProfilesRepository & IBookmarksRepository;
  passwords: PasswordService;
  profiles: ProfileService;
  bookmarks: BookmarksService;
  imports: ImportService;

  constructor(testDatabasePath = "data/test") {
    super();

    const app = this;

    this.modules.push((this.repository = new SqliteRepository(app)));

    const { repository } = this;

    this.modules.push(
      (this.passwords = new PasswordService(app)),
      (this.profiles = new ProfileService(app)),
      (this.bookmarks = new BookmarksService(app)),
      (this.imports = new ImportService(app))
    );

    this.config.set("sqliteDatabasePath", testDatabasePath);
  }

  async init() {
    await rimraf(this.config.get("sqliteDatabasePath"));
    return super.init();
  }

  async deinit() {
    await super.deinit();
    await rimraf(this.config.get("sqliteDatabasePath"));
  }
}

export const buildReadableStreamFromString = (src: string) => {
  const readableStream = new Readable();
  readableStream.push(src);
  readableStream.push(null);
  return readableStream;
};

export interface TestResources {
  [url: string]: {
    headers: Record<string, string>;
    body: string;
  };
}

export const applyFetchMock = (
  t: any,
  fetch: FetchService,
  resources: TestResources
) => {
  return t.mock.method(
    fetch,
    "fetchResource",
    async ({ url }: { url: string | URL }): Promise<FetchResponseFromCache> => {
      const urlStr = url.toString();
      if (!(urlStr in resources)) {
        return { status: 404, cached: false };
      }

      const resource = resources[urlStr];
      const body = new BodyReadableImpl({
        // TODO: supply content-type and content-length here?
      }) as BodyReadable;
      body.push(resource.body);
      body.push(null);

      const resourceStream = buildReadableStreamFromString(resource.body);

      return {
        status: 200,
        headers: resource.headers,
        body,
      };
    }
  );
};
