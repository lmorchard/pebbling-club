import { App } from "../app";
import { Cli } from "../cli";
import { AppModule, CliAppModule } from "../app/modules";
import { Command } from "commander";

import express, { Express } from "express";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import session from "express-session";
import csrf from "csurf";

import authInit from "./auth";

import indexRouter from "./routes/index";
import authRouter from "./routes/auth";
import { ServiceStore } from "../services/sessions";

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
  sessionSecret: {
    doc: "Web session secret",
    env: "SESSION_SECRET",
    format: String,
    default: "trustno1-8675309",
  },
  sessionExpirationInterval: {
    doc: "Web session expiration interval",
    env: "SESSION_EXPIRATION_INTERVAL",
    format: Number,
    default: 1000 * 60 * 10,
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
      .action(this.commandServe.bind(this));

    return this;
  }

  async commandServe() {
    const { config, log } = this.app.context;
    const { services } = this.app;

    const host = config.get("host");
    const port = config.get("port");
    const sessionSecret = config.get("sessionSecret");

    // TODO: this seems hacky?'
    setInterval(
      () => services.sessions.expireSessions(),
      config.get("sessionExpirationInterval")
    );

    const app = express();

    app.use(pinoHttp({ logger: log }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());
    app.use(
      session({
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false }, // TODO: need option to enable https in prod
        store: await services.sessions.buildStore(),
      })
    );
    app.use(csrf());

    // TODO: better flash messages impl needed
    app.use(function (req, res, next) {
      // @ts-ignore
      var msgs = req.session.messages || [];
      res.locals.messages = msgs;
      res.locals.hasMessages = !!msgs.length;
      if (msgs) {
        // @ts-ignore
        req.session.messages = [];
      }
      next();
    });

    app.use(express.static(config.get("publicPath")));

    app.use(function (req, res, next) {
      const csrfToken = req.csrfToken();
      res.locals.globalProps = { csrfToken };
      next();
    });

    await authInit(this, app);

    app.use("/", indexRouter(this, app));
    app.use("/auth", authRouter(this, app));

    app.listen(port, () => {
      log.info(`Server listening on port ${port}`);
    });
  }
}
