import { AppModule } from "../app/modules";
import { IApp } from "../app/types";
import { BookmarksService, IBookmarksRepository } from "./bookmarks";
import { ImportService } from "./imports";
import { IPasswordsRepository, PasswordService } from "./passwords";
import { IProfilesRepository, ProfileService } from "./profiles";

export class Services extends AppModule {
  passwords: PasswordService;
  profiles: ProfileService;
  bookmarks: BookmarksService;
  imports: ImportService;

  constructor(
    app: IApp,
    repository: IPasswordsRepository &
      IProfilesRepository &
      IBookmarksRepository,
  ) {
    super(app);

    this.passwords = new PasswordService(app, repository);
    this.profiles = new ProfileService(app, repository, this.passwords);
    this.bookmarks = new BookmarksService(app, repository);
    this.imports = new ImportService(app, this.bookmarks);
  }
}
