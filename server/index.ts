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
  // TODO: make repository instances switchable via config
  repository = new SqliteRepository({ app: this });
  feedsRepository = new SqliteFeedsRepository({ app: this });
  fetchRepository = new SqliteFetchRepository({ app: this });

  passwords = new PasswordService({ app: this });
  profiles = new ProfileService({ app: this });
  bookmarks = new BookmarksService({ app: this });
  imports = new ImportService({ app: this });
  fetch = new FetchService({ app: this });
  feeds = new FeedsService({ app: this });
  webServer = new WebServer({ app: this });

  constructor() {
    super();

    const app = this;

    this.modules.push(
      this.repository,
      this.feedsRepository,
      this.fetchRepository,
      this.passwords,
      this.profiles,
      this.bookmarks,
      this.imports,
      this.fetch,
      this.feeds,
      this.webServer,
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
