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
    this.program.version(process.env.npm_package_version || "0.0");
    return this;
  }

  async run(argv = process.argv) {
    const { log } = this.app.logging;
    try {
      await this.program.parseAsync(argv);
    } catch (err) {
      log.error({ msg: "Command failed", err });
    } finally {
      this.app.deinit();
    }
  }

  async callModules(mapfn: (m: CliAppModule) => Promise<any>) {
    await Promise.all(
      this.app.modules.filter((m) => m instanceof CliAppModule).map(mapfn)
    );
    return this;
  }
}
