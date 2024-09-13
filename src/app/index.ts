import { Config } from "./config";
import { Logging } from "./logging";
import { AppModule } from "./modules";
import { IApp, IAppModule } from "./types";
import { Events } from "./events";

export class BaseApp implements IApp {
  config: Config;
  logging: Logging;
  events: Events;

  modules: AppModule[];

  constructor() {
    this.modules = [
      (this.config = new Config(this)),
      (this.events = new Events(this)),
      (this.logging = new Logging(this)),
    ];
  }

  async _callModules(mapfn: (m: IAppModule) => Promise<void>) {
    await Promise.all(this.modules.map(mapfn));
  }

  async init() {
    return await this._callModules((m) => m.init());
  }

  async deinit() {
    return await this._callModules((m) => m.deinit());
  }
}
