import { BaseRepository } from "../repositories/base";
import { App } from "../app";

export class BaseService {
  app: App;
  repository: BaseRepository;

  constructor(app: App) {
    this.app = app;
    this.repository = app.repository;
  }

  get log() {
    return this.app.logging.child({
      module: this.constructor.name
    });
  }
}
