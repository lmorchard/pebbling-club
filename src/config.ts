import * as dotenv from "dotenv";
import Convict from "convict";
import { App } from "./app";

export class Config {
  app: App;
  
  constructor(app: App) {
    this.app = app;
  }

  async init() {

    return this;
  }
}
