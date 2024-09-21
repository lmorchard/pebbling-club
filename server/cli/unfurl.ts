import { Command } from "commander";
import { CliAppModule } from "../app/modules";
import { UnfurlService } from "../services/unfurl";

export type IAppRequirements = {
  unfurl: UnfurlService;
};

export default class CliUnfurl extends CliAppModule<IAppRequirements> {
  async initCli(program: Command) {
    const { unfurl } = this.app;

    const unfurlProgram = program
      .command("unfurl")
      .description("unfurl metadata on web resources");

    unfurlProgram
      .command("fetch <url>")
      .description("attempt to fetch a given URL")
      .action(async (url) => {
        const metadata = await unfurl.fetchMetadata(url);
        this.log.info({
          msg: "fetch",
          metadata,
        });
      });
  }
}
