import { Config } from "./config";
import { Logging } from "./logging";
import { AppModule } from "./modules";
import { Events } from "./events";
import { BaseRepository } from "../repositories/base";
import { SqliteRepository } from "../repositories/sqlite/index";
import { Services } from "../services";
import { Server } from "../server/index";

export class App {
  modules: AppModule[];
  events: Events;
  config: Config;
  logging: Logging;
  repository: BaseRepository;
  services: Services;
  server: Server;

  constructor() {
    this.modules = [
      this.config = new Config(this),
      this.events = new Events(this),
      this.logging = new Logging(this),
      this.repository = new SqliteRepository(this), // TODO make switchable later
      this.services = new Services(this),
      this.server = new Server(this),
    ];
  }

  async callModules(mapfn: (m: AppModule) => Promise<any>) {
    await Promise.all(this.modules.map(mapfn));
    return this;
  }

  async init() {
    return await this.callModules(m => m.init());
  }

  async deinit() {
    return await this.callModules(m => m.deinit());
  }
}
