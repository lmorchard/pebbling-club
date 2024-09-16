import { Command } from "commander";
import { CliAppModule } from "../app/modules";
import { FeedsService } from "../services/feeds";

export type IAppRequirements = {
  feeds: FeedsService;
};

export default class CliFeeds extends CliAppModule<IAppRequirements> {
  async initCli(program: Command) {
    const feedsProgram = program
      .command("feeds")
      .description("manipulate web feeds");

    feedsProgram
      .command("get <url>")
      .option("-f, --force", "force fetch")
      .description("attempt to fetch a feed and items from a given URL")
      .action(this.commandGet.bind(this));

    feedsProgram
      .command("autodiscover <url>")
      .option("-f, --force", "force fetch")
      .description("attempt to autodiscover a feed from a given URL")
      .action(this.commandAutodiscover.bind(this));

    feedsProgram
      .command("update <url>")
      .option("-f, --force", "force fetch")
      .description("attempt to update a feed from a given URL")
      .action(this.commandUpdate.bind(this));

    feedsProgram
      .command("poll <url>")
      .option("-f, --force", "force fetch")
      .description("attempt to poll a feed from a given URL")
      .action(this.commandPoll.bind(this));
  }

  async commandGet(url: string, options: { force?: boolean }) {
    const {
      log,
      app: { feeds },
    } = this;
    try {
      const results = await feeds.get(url, { forceFetch: options.force });
      log.info({ msg: "get", results });
    } catch (error) {
      log.error({ msg: (error as Error).message });
    }
  }

  async discover(url: string, options: { force?: boolean }) {
    const {
      log,
      app: { feeds },
    } = this;

    const discovery = await feeds.autodiscover(url, {
      forceFetch: options.force,
    });
    if (!discovery.length) {
      log.info({ msg: "no feeds discovered" });
      return;
    }

    const feedUrl = discovery[0].href;
    log.info({ msg: "discovered", feedUrl });

    return feedUrl;
  }

  async commandAutodiscover(url: string, options: { force?: boolean }) {
    await this.discover(url, options);
  }

  // TODO: support FeedPollOptions
  async commandUpdate(url: string, options: { force?: boolean }) {
    const {
      log,
      app: { feeds },
    } = this;

    const feedUrl = await this.discover(url, options);
    if (feedUrl) {
      const results = await feeds.update(
        { url: feedUrl },
        { forceFetch: options.force }
      );
      log.info({ msg: "update", results });
    }
  }

  async commandPoll(url: string, options: { force?: boolean }) {
    const {
      log,
      app: { feeds },
    } = this;

    const feedUrl = await this.discover(url, options);
    if (feedUrl) {
      const results = await feeds.poll(
        { url: feedUrl },
        { forceFetch: options.force }
      );
      log.info({ msg: "poll", results });
    }
  }
}
