import fs from "fs/promises";

import { Command } from "commander";
import { App } from "./app";
import { Server } from "./server/index";

export class Cli {
  app: App;
  program: Command;
  server: Server;

  constructor() {
    this.app = new App();
    this.server = new Server(this.app);
    this.program = new Command();
  }

  async init() {
    await this.app.init();
    await this.server.init();

    /*
    const packageJsonFn = new URL("../package.json", import.meta.url);
    const packageJsonData = await fs.readFile(packageJsonFn, 'utf-8');
    const packageJson = JSON.parse(packageJsonData);

    this.program.version(packageJson.version);
    */
    
    await this.server.initCli(this);

    return this;
  }

  async run(argv = process.argv) {
    await this.program.parseAsync(argv);
  }  
}
