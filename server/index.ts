#!/usr/bin/env -S npx tsx
import { BaseCliApp } from "./app/cli";

import { SqliteRepository } from "./repositories/sqlite/main";
import SqliteFeedsRepository from "./repositories/sqlite/feeds";
import SqliteFetchRepository from "./repositories/sqlite/fetch";

import { PasswordService } from "./services/passwords";
import { ProfileService } from "./services/profiles";
import { BookmarksService } from "./services/bookmarks";
import { ImportService } from "./services/imports";
import { FetchService } from "./services/fetch";
import { FeedsService } from "./services/feeds";

import WebServer from "./web";

import CliProfiles from "./cli/profiles";
import CliImport from "./cli/import";
import CliBookmarks from "./cli/bookmarks";
import CliFeeds from "./cli/feeds";
import CliDb from "./cli/db";
import CliFetch from "./cli/fetch";

export class MainCliApp extends BaseCliApp {
  repository: SqliteRepository;
  feedsRepository: SqliteFeedsRepository;
  fetchRepository: SqliteFetchRepository;

  passwords: PasswordService;
  profiles: ProfileService;
  bookmarks: BookmarksService;
  imports: ImportService;
  fetch: FetchService;
  feeds: FeedsService;

  constructor() {
    super();

    const app = this;

    this.modules.push(
      (this.repository = new SqliteRepository({ app })), // TODO make switchable
      (this.feedsRepository = new SqliteFeedsRepository({ app })),
      (this.fetchRepository = new SqliteFetchRepository({ app }))
    );

    const { repository, feedsRepository, fetchRepository } = this;

    this.modules.push(
      (this.passwords = new PasswordService({ app, repository })),
      (this.profiles = new ProfileService({
        app,
        repository,
        passwords: this.passwords,
      })),
      (this.bookmarks = new BookmarksService({ app, repository })),
      (this.imports = new ImportService({ app, bookmarks: this.bookmarks })),
      (this.fetch = new FetchService({
        app,
        repository: fetchRepository,
      })),
      (this.feeds = new FeedsService({
        app,
        repository: feedsRepository,
        fetch: this.fetch,
      }))
    );

    this.modules.push(
      new WebServer({ app }),
      new CliDb({ app }),
      new CliProfiles({ app }),
      new CliImport({ app }),
      new CliBookmarks({ app }),
      new CliFeeds({ app }),
      new CliFetch({ app })
    );
  }
}

async function main() {
  const app = new MainCliApp();
  await app.init();
  return app.run();
}

main().catch(console.error);
