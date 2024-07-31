import { Command } from "commander";
import { App } from ".";
import { CliAppModule } from "./modules";

export class Cli {
  app: App;
  program: Command;

  constructor() {
    this.app = new App();
    this.program = new Command();
  }

  async init() {
    await this.app.init();
    await this.callModules(async (m) => m.initCli(this));
    this.program
      .version(process.env.npm_package_version || "0.0")
      .hook("postAction", () => void this.app.deinit());
    return this;
  }

  async run(argv = process.argv) {
    await this.program.parseAsync(argv);
  }

  async callModules(mapfn: (m: CliAppModule) => Promise<any>) {
    await Promise.all(
      this.app.modules.filter((m) => m instanceof CliAppModule).map(mapfn)
    );
    return this;
  }
}
