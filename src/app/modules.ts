import { Command } from "commander";
import { App } from ".";
import { Cli } from "../cli";

export class AppModule {
  app: App;

  static configSchema = {};

  constructor(app: App) {
    this.app = app;
  }

  async init() {
    return this;
  }

  async deinit() {
    return this;
  }
}

export class CliAppModule extends AppModule {
  async initCli(cli: Cli) {
    return this;
  }
  async preCliAction(thisCommand: Command, actionCommand: Command) { }
  async postCliAction(thisCommand: Command, actionCommand: Command) { }
}
