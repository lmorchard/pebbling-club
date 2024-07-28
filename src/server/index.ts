import { App } from "../app";
import { Cli } from "../cli";
import { Command } from "commander";

export class Server {
  app: App;
  
  constructor(app: App) {
    this.app = app;
  }

  async init() {

    return this;
  }

  async initCli(cli: Cli) {
    const { program } = cli;

    program
      .command("serve")
      .description("start the web application server")
      .action(this.serve.bind(this))
  }

  serve() {
    console.log("SERVE");
  }
}
