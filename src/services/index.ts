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

    this.passwords = new PasswordService(app);
    this.bookmarks = new BookmarksService(app);
    this.sessions = new SessionsService(app);
    this.imports = new ImportService(app, this.bookmarks);
  }
}
