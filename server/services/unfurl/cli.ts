import { Command } from "commander";
import { CliAppModule } from "../../app/modules";
import { UnfurlService } from ".";
import { BookmarksService } from "../bookmarks";
import { ProfileService } from "../profiles";

export type IAppRequirements = {
  bookmarks: BookmarksService;
  profiles: ProfileService;
  unfurl: UnfurlService;
};

export default class CliUnfurl extends CliAppModule<IAppRequirements> {
  async initCli(program: Command) {
    const { log } = this;
    const { unfurl, bookmarks, profiles } = this.app;

    const unfurlProgram = program
      .command("unfurl")
      .description("unfurl metadata on web resources");

    unfurlProgram
      .command("fetch")
      .argument("<url>", "url")
      .description("attempt to fetch a given URL")
      .action(async (url) => {
        const metadata = await unfurl.fetchMetadata(url);
        this.log.info({
          msg: "fetch",
          metadata,
        });
      });

    unfurlProgram
      .command("backfill")
      .argument("<username>", "username")
      .description("backfull unfurl data in bulk for a user")
      .option("--force-fetch", "force fetch metadata even if it's cached")
      .option(
        "--force-update",
        "force update metadata even if it's already backfilled"
      )
      .option(
        "--skip-update-on-error",
        "skip updating bookmark if error encountered on unfurl"
      )
      .option("--batch <size>", "batch size for unfurl")
      .action(
        async (
          username: string,
          options: {
            forceFetch: boolean;
            forceUpdate: boolean;
            skipUpdateOnError: boolean;
            batch: string;
          }
        ) => {
          const profile = await profiles.getByUsername(username);
          if (!profile?.id) {
            log.error({ msg: "profile does not exist", username });
            return;
          }

          await unfurl.backfillMetadataForBookmarks({
            ownerId: profile.id,
            forceFetch: options.forceFetch,
            forceUpdate: options.forceUpdate,
            skipUpdateOnError: options.skipUpdateOnError,
            batchSize: options.batch ? parseInt(options.batch) : undefined,
          });

          process.exit();
        }
      );
  }
}
