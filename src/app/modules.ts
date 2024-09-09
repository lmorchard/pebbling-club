import { IAppModule, IApp, ICliApp } from "./types";

export class AppModule implements IAppModule {
  app: IApp;

  static configSchema = {};

  constructor(app: IApp) {
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
  async initCli(app: ICliApp) {
    return this;
  }
}
