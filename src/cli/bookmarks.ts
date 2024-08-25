import { App } from "../app";
import { Cli } from "../app/cli";
import { CliAppModule } from "../app/modules";
import { IApp, IWithServices } from "../app/types";

export default class CliBookmarks extends CliAppModule {
  app: IApp & IWithServices;

  constructor(app: IApp & IWithServices) {
    super(app);
    this.app = app;
  }

  async initCli(cli: Cli) {
    const { program } = cli;

    const bookmarksProgram = program
      .command("bookmarks")
      .description("manage bookmarks");

    bookmarksProgram
      .command("create <username> <href>")
      .option("-t, --title <title>", "title")
      .option("-e, --extended <extended>", "extended description")
      .option("-g, --tags <tags>", "tags")
      .option("-v, --visibility <visibility>", "visibility")
      .description("create a bookmark")
      .action(this.commandCreate.bind(this));

    bookmarksProgram
      .command("update <id>")
      .option("-o, --owner <owner>", "owner")
      .option("-h, --href <href>", "href")
      .option("-t, --title <title>", "title")
      .option("-e, --extended <extended>", "extended description")
      .option("-g, --tags <tags>", "tags")
      .option("-v, --visibility <visibility>", "visibility")
      .description("create a bookmark")
      .action(this.commandUpdate.bind(this));

    bookmarksProgram
      .command("list <username>")
      .description("list bookmarks by user")
      .option("-t, --tags <tags>", "constrain list by tags")
      .option("-l, --limit <limit>", "limit bookmarks listed")
      .option("-o --offset <offset>", "offset in bookmark listed")
      .action(this.commandList.bind(this));

    bookmarksProgram
      .command("get <id>")
      .description("get a bookmark")
      .action(this.commandGet.bind(this));

    bookmarksProgram
      .command("delete <id>")
      .description("delete a bookmark")
      .action(this.commandDelete.bind(this));

    return this;
  }

  async commandList(
    username: string,
    options: { tags: string; limit: number; offset: number }
  ) {
    const { log } = this;
    const { bookmarks, profiles } = this.app.services;

    const profile = await profiles.getByUsername(username);
    if (!profile?.id) {
      log.error({ msg: "profile does not exist", username });
      return;
    }

    const { id: ownerId } = profile;
    const { limit = 10, offset = 0 } = options;

    let total, items;
    if (options.tags) {
      const tags = options.tags.split(/ +/g);
      ({ total, items } = await bookmarks.listForOwnerByTags(
        ownerId,
        tags,
        limit,
        offset
      ));
    } else {
      ({ total, items } = await bookmarks.listForOwner(ownerId, limit, offset));
    }

    log.info({ msg: "Total bookmarks", total });
    items.forEach((bookmark) => {
      log.info(bookmark);
    });
  }

  async commandGet(id: string) {
    const { log } = this;
    const { bookmarks } = this.app.services;

    const bookmark = await bookmarks.get(id);
    if (!bookmark) {
      log.error({ msg: "bookmark does not exist", id });
      return;
    }

    log.info(bookmark);
  }

  async commandCreate(
    username: string,
    href: string,
    options: {
      title: string;
      extended: string;
      tags: string;
      visibility: string;
    }
  ) {
    const { log } = this;
    const { bookmarks, profiles } = this.app.services;

    const profile = await profiles.getByUsername(username);
    if (!profile?.id) {
      log.error({ msg: "profile does not exist", username });
      return;
    }

    const { id: ownerId } = profile;
    const tags = (options.tags || "").split(/ /g);
    const bookmark = { ...options, ownerId, href, tags };
    const result = await bookmarks.create(bookmark);
    log.info({ msg: "Bookmark created", result });
  }

  async commandDelete(id: string) {
    const { log } = this;
    const { bookmarks } = this.app.services;
    const result = await bookmarks.delete(id);
    log.info({ msg: "Bookmark deleted", id, result });
  }

  async commandUpdate(
    id: string,
    options: {
      owner: string;
      href: string;
      title: string;
      extended: string;
      tags: string;
      visibility: string;
    }
  ) {
    const { log } = this;
    const { bookmarks, profiles } = this.app.services;

    const bookmark = await bookmarks.get(id);
    if (!bookmark) {
      log.error({ msg: "bookmark does not exist", id });
      return;
    }

    const profile = await profiles.getByUsername(options.owner);
    if (!profile?.id) {
      log.error({ msg: "profile does not exist", username: options.owner });
      return;
    }
  }
}
