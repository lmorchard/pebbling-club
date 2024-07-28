import { App } from "../app";
import { Cli } from "../cli";
import { AppModule, CliAppModule } from "../app/modules";
import { Command } from "commander";

import express, { Express } from "express";
import pinoHttp from "pino-http";

import authInit from "./auth";

import indexRouter from "./routes/index";

export const configSchema = {
  host: {
    doc: "Server host",
    env: "HOST",
    format: String,
    default: "localhost",
  },
  port: {
    doc: "Server port",
    env: "PORT",
    format: Number,
    default: 8089,
  },
  publicPath: {
    doc: "Public web static resources path",
    env: "PUBLIC_PATH",
    format: String,
    default: "public",
  },
  siteUrl: {
    doc: "Server base URL",
    env: "SITE_URL",
    nullable: true,
    default: null,
  },
  /*
  projectDomain: {
    doc: "Glitch.com project domain",
    env: "PROJECT_DOMAIN",
    nullable: true,
    default: null,
  },
  projectId: {
    doc: "Glitch.com project ID",
    env: "PROJECT_ID",
    nullable: true,
    default: null,
  },
  */
} as const;

export class Server extends CliAppModule {
  serverApp?: Express;
  
  async init() {
    return this;
  }

  async initCli(cli: Cli) {
    const { program } = cli;

    program
      .command("serve")
      .description("start the web application server")
      .action(this.commandServe.bind(this))

    return this;
  }

  async commandServe() {
    const { config, log } = this.app.context;
    
    const host = config.get("host");
    const port = config.get("port");

    const app = express();

    app.use(pinoHttp({ logger: log }));    
    app.use(express.static(config.get("publicPath")));

    await authInit(app);

    app.use("/", indexRouter());

    app.listen(port, () => {
      log.info(`Server listening on port ${port}`);
    });
  }
}
