import { BaseRepository } from "../repositories/base";
import { BaseApp, BaseLogger } from "../app/types";

export class BaseService {
  app: BaseApp;
  log: BaseLogger;

  constructor(app: BaseApp) {
    this.app = app;
    this.log = app.logging.child({ module: this.constructor.name });
  }
}
