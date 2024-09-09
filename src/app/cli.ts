import { Command } from "commander";
import { BaseApp } from ".";
import { CliAppModule } from "./modules";
import { ICliAppModule } from "./types";

export class BaseCliApp extends BaseApp {
  program: Command;

  constructor() {
    super();
    this.program = new Command();
  }

  async init() {
    await super.init();
    this.program.version(process.env.npm_package_version || "0.0");
    await this.initCli();
    return this;
  }

  async initCli() {
    return this._callCliModules(async (m) => m.initCli(this));
  }

  async _callCliModules(mapfn: (m: ICliAppModule) => Promise<any>) {
    return this._callModules(async (m) => {
      if (m instanceof CliAppModule) mapfn(m);
    });
  }

  async run(argv = process.argv) {
    const { log } = this.logging;
    try {
      await this.program.parseAsync(argv);
    } catch (err) {
      log.error({ msg: "Command failed", err });
    } finally {
      this.deinit();
    }
  }
}
