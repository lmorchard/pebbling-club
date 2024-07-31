import { App } from "../app";
import { AppModule } from "../app/modules";
import { BookmarksService } from "./bookmarks";
import { ImportService } from "./imports";
import { PasswordService } from "./passwords";
import { SessionsService } from "./sessions";

export class Services extends AppModule {
  passwords: PasswordService;
  bookmarks: BookmarksService;
  sessions: SessionsService;
  imports: ImportService;

  constructor(app: App) {
    super(app);
    const { repository } = app;

    this.passwords = new PasswordService(repository);
    this.bookmarks = new BookmarksService(repository);
    this.sessions = new SessionsService(repository);
    this.imports = new ImportService(repository, app.logging, this.bookmarks);
  }
}
