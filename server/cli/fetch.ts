import { Command } from "commander";
import { CliAppModule } from "../app/modules";
import { FetchService } from "../services/fetch";

export type IAppRequirements = {
  fetch: FetchService;
};

export default class CliFetch extends CliAppModule<IAppRequirements> {
  async initCli(program: Command) {
    const { fetch } = this.app;

    const fetchProgram = program
      .command("fetch")
      .description("fetch web resources with caching");

    fetchProgram
      .command("get <url>")
      .description("attempt to fetch a given URL")
      .action(async (url) => {
        const { response, meta } = await fetch.fetchResource({ url });
        const { status, statusText, headers } = response;
        this.log.info({
          msg: "get",
          meta,
          status,
          statusText,
          headers: headers.raw(),
        });
      });

    fetchProgram
      .command("clear")
      .description("clear cached resources")
      .action(async () => {
        this.log.info({
          msg: "clear",
          results: await fetch.clearCachedResources(),
        });
      });
  }
}
