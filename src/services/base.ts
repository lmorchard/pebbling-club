import { BaseRepository } from "../repositories/base";
import { BaseApp, BaseLogger } from "../app/types";

export class BaseService {
  app: BaseApp;

  constructor(app: BaseApp) {
    this.app = app;
  }

  get log() {
    return this.app.logging.child({ module: this.constructor.name });
  }
}
