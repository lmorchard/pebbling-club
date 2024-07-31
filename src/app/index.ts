import { Config } from "./config";
import { Logging } from "./logging";
import { AppModule } from "./modules";
import { BaseAppModule, BaseEvents, BaseLogger, BaseConfig, BaseApp } from "./types";
import { Events } from "./events";
import { BaseRepository } from "../repositories/base";
import { SqliteRepository } from "../repositories/sqlite/index";
import { Services } from "../services";

export class App implements BaseApp {
  config: Config;
  logging: Logging;
  events: Events;
  repository: BaseRepository;

  modules: AppModule[];
  registered: Record<string, AppModule>;

  services: Services;

  constructor() {
    this.modules = [
      (this.config = new Config(this)),
      (this.events = new Events(this)),
      (this.logging = new Logging(this)),
      (this.repository = new SqliteRepository(this)), // TODO make switchable later
      (this.services = new Services(this)),
    ];
    this.registered = {};
  }

  registerModule(name: string, moduleConstructor: new (app: App) => AppModule) {
    const module = new moduleConstructor(this);
    this.modules.push(module);
    this.registered[name] = module;
    return this;
  }

  async _callModules(mapfn: (m: BaseAppModule) => Promise<any>) {
    await Promise.all(this.modules.map(mapfn));
    return this;
  }

  async init() {
    return await this._callModules((m) => m.init());
  }

  async deinit() {
    return await this._callModules((m) => m.deinit());
  }
}
