import { Cli } from "./cli";
import { BaseAppModule, BaseApp } from "./types";

export class AppModule implements BaseAppModule {
  app: BaseApp;

  static configSchema = {};

  constructor(app: BaseApp) {
    this.app = app;
  }

  get log() {
    return this.app.logging.child({
      module: this.constructor.name,
    });
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
}
