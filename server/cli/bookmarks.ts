import { Command } from "commander";
import { CliAppModule } from "../app/modules";
import { IApp, ICliApp } from "../app/types";
import { BookmarksService } from "../services/bookmarks";
import { ProfileService } from "../services/profiles";

export type IAppRequirements = {
    bookmarks: BookmarksService;
    profiles: ProfileService;
};

export default class CliBookmarks extends CliAppModule<IAppRequirements> {
  async initCli(program: Command) {
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
      .command("list-tags <username>")
      .description("list tags by user")
      .option("-l, --limit <limit>", "limit bookmarks listed")
      .option("-o --offset <offset>", "offset in bookmark listed")
      .action(this.commandListTags.bind(this));

    bookmarksProgram
      .command("get <id>")
      .description("get a bookmark")
      .action(this.commandGet.bind(this));

    bookmarksProgram
      .command("delete <id>")
      .description("delete a bookmark")
      .action(this.commandDelete.bind(this));
  }

  async commandList(
    username: string,
    options: { tags: string; limit: number; offset: number }
  ) {
    const { log } = this;
    const { bookmarks, profiles } = this.app;

    const profile = await profiles.getByUsername(username);
    if (!profile?.id) {
      log.error({ msg: "profile does not exist", username });
      return;
    }

    const viewerId = profile.id; // TODO: specify an admin user here?

    const { id: ownerId } = profile;
    const { limit = 10, offset = 0 } = options;

    let total, items;
    if (options.tags) {
      const tags = options.tags.split(/ +/g);
      ({ total, items } = await bookmarks.listForOwnerByTags(
        viewerId,
        ownerId,
        tags,
        limit,
        offset
      ));
    } else {
      ({ total, items } = await bookmarks.listForOwner(
        viewerId,
        ownerId,
        limit,
        offset
      ));
    }

    log.info({ msg: "Total bookmarks", total });
    items.forEach((bookmark) => log.info({ msg: "bookmark", bookmark }));
  }

  async commandListTags(
    username: string,
    options: { limit: number; offset: number }
  ) {
    const { log } = this;
    const { bookmarks, profiles } = this.app;

    const profile = await profiles.getByUsername(username);
    if (!profile?.id) {
      log.error({ msg: "profile does not exist", username });
      return;
    }

    const { id: ownerId } = profile;
    const { limit = 10, offset = 0 } = options;

    const result = await bookmarks.listTagsForOwner(ownerId, limit, offset);
    for (const tag of result) {
      log.info({ msg: "tag count", tag });
    }
  }

  async commandGet(id: string) {
    const { log } = this;
    const { bookmarks } = this.app;
    const viewerId = undefined; // TOSO: add a viewer profile option?

    const bookmark = await bookmarks.get(viewerId, id);
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
    const { bookmarks, profiles } = this.app;

    const profile = await profiles.getByUsername(username);
    if (!profile?.id) {
      log.error({ msg: "profile does not exist", username });
      return;
    }

    const { id: ownerId } = profile;
    const tags = (options.tags || "").split(/ /g);
    const bookmark = { ...options, ownerId, href, tags };
    const result = await bookmarks.upsert(bookmark);
    log.info({ msg: "Bookmark created", result });
  }

  async commandDelete(id: string) {
    const { log } = this;
    const { bookmarks } = this.app;
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
    const { bookmarks, profiles } = this.app;
    const viewerId = undefined; // TOSO: add a viewer profile option?

    const bookmark = await bookmarks.get(viewerId, id);
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
