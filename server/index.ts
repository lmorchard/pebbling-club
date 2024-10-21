#!/usr/bin/env -S npx tsx
import { BaseCliApp } from "./app/cli";

import { SqliteRepository } from "./repositories/sqlite/main";
import SqliteFeedsRepository from "./repositories/sqlite/feeds";
import SqliteFetchRepository from "./repositories/sqlite/fetch";
import SqliteUnfurlRepository from "./repositories/sqlite/unfurl";

import { PasswordService } from "./services/passwords";
import { ProfileService } from "./services/profiles";
import { BookmarksService } from "./services/bookmarks";
import { ImportService } from "./services/imports";
import { FetchService } from "./services/fetch";
import { FeedsService } from "./services/feeds";
import { UnfurlService } from "./services/unfurl";

import WebServer from "./web";

import CliProfiles from "./cli/profiles";
import CliImport from "./cli/import";
import CliBookmarks from "./cli/bookmarks";
import CliFeeds from "./cli/feeds";
import CliDb from "./cli/db";
import CliFetch from "./cli/fetch";
import CliUnfurl from "./services/unfurl/cli";

export class MainCliApp extends BaseCliApp {
  // TODO: make repository instances switchable via config
  feedsRepository = new SqliteFeedsRepository(this);
  fetchRepository = new SqliteFetchRepository(this);
  unfurlRepository = new SqliteUnfurlRepository(this);
  repository = new SqliteRepository(this);

  passwords = new PasswordService(this);
  profiles = new ProfileService(this);
  bookmarks = new BookmarksService(this);
  imports = new ImportService(this);
  fetch = new FetchService(this);
  feeds = new FeedsService(this);
  unfurl = new UnfurlService(this);
  webServer = new WebServer(this);

  constructor() {
    super();

    const app = this;

    this.modules.push(
      this.feedsRepository,
      this.fetchRepository,
      this.unfurlRepository,
      this.repository,
      this.passwords,
      this.profiles,
      this.bookmarks,
      this.imports,
      this.fetch,
      this.feeds,
      this.unfurl,
      this.webServer,
      new CliDb(this),
      new CliProfiles(this),
      new CliImport(this),
      new CliBookmarks(this),
      new CliFeeds(this),
      new CliFetch(this),
      new CliUnfurl(this)
    );
  }
}

async function main() {
  const app = new MainCliApp();
  await app.init();
  return app.run();
}

main().catch(console.error);
