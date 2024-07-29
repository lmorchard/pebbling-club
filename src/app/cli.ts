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
    await this.callModules(m => m.initCli(this));
    this.program
      .version(process.env.npm_package_version || "0.0")
      .hook("postAction", () => void(this.app.deinit()));
    return this;
  }

  async run(argv = process.argv) {
    await this.program.parseAsync(argv);
  }

  get cliModules() {
    return this.app.modules.filter(m => m instanceof CliAppModule);
  }

  async callModules(mapfn: (m: CliAppModule) => Promise<any>) {
    return Promise.all(this.cliModules.map(mapfn));
  }
}
