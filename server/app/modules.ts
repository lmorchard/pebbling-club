import { IAppModule, IApp, ICliApp } from "./types";
import { Command } from "commander";

export class AppModule<IAppRequirements = {}> implements IAppModule {
  app: IApp & IAppRequirements;

  static configSchema = {};

  constructor({ app }: { app: IApp & IAppRequirements }) {
    this.app = app;
  }

  get log() {
    return this.app.logging.child({
      name: this.constructor.name,
    });
  }

  async init() {}

  async deinit() {}
}

export class CliAppModule<
  IAppRequirements = {}
> extends AppModule<IAppRequirements> {
  async initCli(program: Command) {}
}
