import { rimraf } from "rimraf";
import { Readable } from "stream";
import { BaseApp } from "../app";
import { AppModule } from "../app/modules";
import { IApp } from "../app/types";
import { SqliteRepository } from "../repositories/sqlite";
import { BookmarksService, IBookmarksRepository } from "../services/bookmarks";
import { ImportService } from "../services/imports";
import { PasswordService, IPasswordsRepository } from "../services/passwords";
import { ProfileService, IProfilesRepository } from "../services/profiles";

export class TestServices extends AppModule {
  passwords: PasswordService;
  profiles: ProfileService;
  bookmarks: BookmarksService;
  imports: ImportService;

  constructor(app: TestApp) {
    super(app);

    const { repository } = app;

    this.passwords = new PasswordService(app, repository);
    this.profiles = new ProfileService(app, repository, this.passwords);
    this.bookmarks = new BookmarksService(app, repository);
    this.imports = new ImportService(app, this.bookmarks);
  }
}

export class TestApp extends BaseApp implements IApp {
  repository: IPasswordsRepository & IProfilesRepository & IBookmarksRepository;
  services: TestServices;

  constructor(testDatabasePath = "data/test") {
    super();

    this.modules.push(
      (this.repository = new SqliteRepository(this)),
      (this.services = new TestServices(this))
    );

    this.config.set("sqliteDatabasePath", testDatabasePath);
  }

  async init() {
    await rimraf(this.config.get("sqliteDatabasePath"));
    return super.init();
  }

  async deinit() {
    await super.deinit();
    //await rimraf(this.config.get("sqliteDatabasePath"));
  }
}

export const buildReadableStreamFromString = (src: string) => {
  const readableStream = new Readable();
  readableStream.push(src);
  readableStream.push(null);
  return readableStream;
};
