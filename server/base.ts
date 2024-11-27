#!/usr/bin/env -S npx tsx
import { BaseApp } from "./app";

import { SqliteRepository } from "./repositories/sqlite/main";
import SqliteFeedsRepository from "./repositories/sqlite/feeds";
import SqliteFetchRepository from "./repositories/sqlite/fetch";
import SqliteUnfurlRepository from "./repositories/sqlite/unfurl";
import SqliteJobsRepository from "./repositories/sqlite/jobs";

import { PasswordService } from "./services/passwords";
import { ProfileService } from "./services/profiles";
import { BookmarksService } from "./services/bookmarks";
import { ImportService } from "./services/imports";
import { FetchService } from "./services/fetch";
import { FeedsService } from "./services/feeds";
import { UnfurlService } from "./services/unfurl";
import { JobsService } from "./services/jobs";

import WebServer from "./web";

export class BaseServerApp extends BaseApp {
  // TODO: make repository instances switchable via config
  feedsRepository = new SqliteFeedsRepository(this);
  fetchRepository = new SqliteFetchRepository(this);
  unfurlRepository = new SqliteUnfurlRepository(this);
  jobsRepository = new SqliteJobsRepository(this);
  repository = new SqliteRepository(this);

  jobs = new JobsService(this);
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
  
    this.modules.push(
      this.feedsRepository,
      this.fetchRepository,
      this.unfurlRepository,
      this.jobsRepository,
      this.repository,

      this.jobs,
      this.passwords,
      this.profiles,
      this.bookmarks,
      this.imports,
      this.fetch,
      this.feeds,
      this.unfurl,
      this.webServer,
    );
  }
}
