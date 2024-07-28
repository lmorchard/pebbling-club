import fs from "fs/promises";

import { Command } from "commander";
import { App } from "./app";
import { AppModule, CliAppModule } from "./app/modules";
import { Server } from "./server/index";

export class Cli {
  app: App;
  program: Command;
  server: Server;

  constructor() {
    this.app = new App();
    this.app.add(
      this.server = new Server(this.app)
    );
    this.program = new Command();
  }

  async init() {
    await this.app.init();
    await this.callModules(m => m.initCli(this));
    this.program
      .version(process.env.npm_package_version || "0.0")
      .hook("preAction", this.preCliAction.bind(this))
      .hook("postAction", this.postCliAction.bind(this));
    return this;
  }

  async preCliAction(thisCommand: Command, actionCommand: Command) {
    await this.callModules(m => m.preCliAction(thisCommand, actionCommand));
  }

  async postCliAction(thisCommand: Command, actionCommand: Command) {
    await this.callModules(m => m.postCliAction(thisCommand, actionCommand));
  }

  get cliModules() {
    return this.app.modules.filter(m => m instanceof CliAppModule);
  }

  async callModules(mapfn: (m: CliAppModule) => Promise<any>) {
    return Promise.all(this.cliModules.map(mapfn));
  }

  async run(argv = process.argv) {
    await this.program.parseAsync(argv);
  }
}
