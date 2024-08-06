import { App } from "../app";
import { AppModule } from "../app/modules";
import { BookmarksService } from "./bookmarks";
import { ImportService } from "./imports";
import { PasswordService } from "./passwords";
import { ProfileService } from "./profiles";

export class Services extends AppModule {
  passwords: PasswordService;
  profiles: ProfileService;
  bookmarks: BookmarksService;
  imports: ImportService;

  constructor(app: App) {
    super(app);

    const { repository } = app;

    this.passwords = new PasswordService(app, repository);
    this.profiles = new ProfileService(app, repository, this.passwords);
    this.bookmarks = new BookmarksService(app, repository);
    this.imports = new ImportService(app, this.bookmarks);
  }
}
