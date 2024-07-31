import { Cli } from "../app/cli";
import { CliAppModule } from "../app/modules";
import CliUsers from "./users";
import CliImport from "./import";

export default class CliIndex extends CliAppModule {
  async init() {
    const { app } = this;

    app.registerModule("users", CliUsers);
    app.registerModule("import", CliImport);

    return this;
  }

  async initCli(cli: Cli) {
    const { program } = cli;
    /*
    program
      .command("serve")
      .description("start the web application server")
      .action(this.commandServe.bind(this));
    */
    return this;
  }
}
