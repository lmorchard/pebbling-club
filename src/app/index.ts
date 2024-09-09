import { Config } from "./config";
import { Logging } from "./logging";
import { AppModule } from "./modules";
import { IApp, IAppModule, IWithServices } from "./types";
import { Events } from "./events";
import { SqliteRepository } from "../repositories/sqlite/index";
import { Services } from "../services";

export class BaseApp implements IApp {
  config: Config;
  logging: Logging;
  events: Events;

  modules: AppModule[];
  registered: Record<string, AppModule>;

  constructor() {
    this.modules = [
      (this.config = new Config(this)),
      (this.events = new Events(this)),
      (this.logging = new Logging(this)),
    ];
    this.registered = {};
  }

  async _callModules(mapfn: (m: IAppModule) => Promise<any>) {
    await Promise.all(this.modules.map(mapfn));
    return this;
  }

  async init() {
    return await this._callModules((m) => m.init());
  }

  async deinit() {
    return await this._callModules((m) => m.deinit());
  }

  registerModule(
    name: string,
    moduleConstructor: new (app: IApp | (IApp & IWithServices)) => AppModule
  ) {
    const module = new moduleConstructor(this);
    this.modules.push(module);
    this.registered[name] = module;
    return this;
  }
}

export class App extends BaseApp implements IWithServices {
  repository: SqliteRepository;
  services: Services;

  constructor() {
    super();
    this.modules.push(
      (this.repository = new SqliteRepository(this)), // TODO make switchable later
      (this.services = new Services(this))
    );
  }
}
