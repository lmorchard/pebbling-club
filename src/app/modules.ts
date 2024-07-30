import { App } from ".";
import { Cli } from "./cli";

export class AppModule {
  app: App;

  static configSchema = {};

  constructor(app: App) {
    this.app = app;
  }

  get log() {
    return this.app.logging.child({
      module: this.constructor.name
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
