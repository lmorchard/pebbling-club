import { App } from "./app";

export class Logging {
  app: App;
  
  constructor(app: App) {
    this.app = app;
  }

  async init() {

    return this;
  }
}
