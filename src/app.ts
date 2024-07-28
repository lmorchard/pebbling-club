import { Config } from "./config";
import { Logging } from "./logging";

export async function init() {
  return new App().init();
}

export class App {
  config: Config;  
  logging: Logging;

  constructor() {
    this.config = new Config(this);
    this.logging = new Logging(this);
  }

  async init(){
    await this.logging.init();
    await this.config.init();
    
    return this;
  }

}
