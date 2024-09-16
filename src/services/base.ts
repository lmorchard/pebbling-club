import { IApp } from "../app/types";

export class BaseService {
  app: IApp;

  constructor(app: IApp) {
    this.app = app;
  }

  get log() {
    return this.app.logging.child({ name: this.constructor.name });
  }
}
