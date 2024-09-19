import Server from "../web";
import { SqliteRepository } from "../repositories/sqlite/main";
import SqliteFeedsRepository from "../repositories/sqlite/feeds";
import SqliteFetchRepository from "../repositories/sqlite/fetch";
import { Services } from "../services";
import { BaseCliApp } from "../app/cli";
import { FetchService } from "../services/fetch";
import { FeedsService } from "../services/feeds";
import CliProfiles from "../cli/profiles";
import CliImport from "../cli/import";
import CliBookmarks from "../cli/bookmarks";
import CliFeeds from "./feeds";
import CliDb from "./db";
import CliFetch from "./fetch";

export class MainCliApp extends BaseCliApp {
  repository: SqliteRepository;
  feedsRepository: SqliteFeedsRepository;
  fetchRepository: SqliteFetchRepository;

  services: Services;

  fetch: FetchService;
  feeds: FeedsService;

  constructor() {
    super();
    this.modules.push(

      (this.repository = new SqliteRepository(this)), // TODO make switchable
      (this.feedsRepository = new SqliteFeedsRepository(this)),
      (this.fetchRepository = new SqliteFetchRepository(this)),
      
      new CliDb(this),

      (this.services = new Services(this, this.repository)),
      (this.fetch = new FetchService(this, this.fetchRepository)),
      (this.feeds = new FeedsService(this, this.feedsRepository, this.fetch)),

      new CliProfiles(this),
      new CliImport(this),
      new CliBookmarks(this),
      new CliFeeds(this),
      new CliFetch(this),

      new Server(this),
    );
  }
}
