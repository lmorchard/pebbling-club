import { Config } from "../config";
import { Logging } from "../logging";
import { AppModule } from "./modules";
import { Events } from "../events";
import { BaseRepository } from "../repositories/index";
import { SqliteRepository } from "../repositories/sqlite/index";

export class App {
  modules: AppModule[];
  events: Events;
  config: Config;
  logging: Logging;
  repository: BaseRepository;

  constructor() {
    this.modules = [
      this.events = new Events(this),
      this.config = new Config(this),
      this.logging = new Logging(this),
      this.repository = new SqliteRepository(this),
    ];
  }

  add(...modules: AppModule[]) {
    this.modules.push(...modules);
    return this;
  }

  get context() {
    return {
      config: this.config.config,
      log: this.logging.log,
    }
  }

  async callModules(mapfn: (m: AppModule) => Promise<any>) {
    return Promise.all(this.modules.map(mapfn));
  }

  async init() {
    await this.callModules(m => m.init());
    return this;
  }

  async deinit() {
    await this.callModules(m => m.deinit());
    return this;
  }
}
