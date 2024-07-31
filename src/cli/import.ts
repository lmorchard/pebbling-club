import { Cli } from "../app/cli";
import { CliAppModule } from "../app/modules";

export default class CliImport extends CliAppModule {
  async init() {
    const { app } = this;

    return this;
  }

  async initCli(cli: Cli) {
    const { program } = cli;

    const importProgram = program.command("import").description("import data");

    importProgram
      .command("pinboard")
      .description("import a pinboard JSON export")
      .action(this.commandPinboard.bind(this));

    return this;
  }

  async commandPinboard() {
    const { log } = this;
    log.info("importing from pinboard JSON export");
  }
}
