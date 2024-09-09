import Server from "../server";
import { SqliteRepository } from "../repositories/sqlite";
import { Services } from "../services";
import CliProfiles from "../cli/profiles";
import CliImport from "../cli/import";
import CliBookmarks from "../cli/bookmarks";
import CliSqlite from "../repositories/sqlite/cli";
import { BaseCliApp } from "../app/cli";

export class MainCliApp extends BaseCliApp {
  repository: SqliteRepository;
  services: Services;

  constructor() {
    super();
    this.modules.push(
      (this.repository = new SqliteRepository(this)), // TODO make switchable
      (this.services = new Services(this)),
      new Server(this),
      new CliProfiles(this),
      new CliImport(this),
      new CliBookmarks(this),
      new CliSqlite(this), // TODO make switchable along with repository
    );
  }
}
