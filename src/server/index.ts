import { Cli } from "../app/cli";
import { CliAppModule } from "../app/modules";

import express, { Express, ErrorRequestHandler } from "express";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import session from "express-session";
import flash, { getFlashMessages } from "express-flash-message";
import csrf from "csurf";

import setupAuth from "./auth";

import homeRouter from "./home/router";
import authRouter from "./auth/router";
import { renderWithLocals } from "./utils/templates";
import templateError from "./templates/error";
import { format } from "path";

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
  sessionKeyFlashMessages: {
    doc: "Session key for flash messages",
    env: "SESSION_KEY_FLASH_MESSAGES",
    format: String,
    default: "express-flash-message",
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

type GetFlashMessages = (
  type: "error" | "info" | "warn"
) => string[] | undefined;

declare global {
  namespace Express {
    interface Request {
      flash: Express.Response["flash"];
    }
    interface Locals {
      csrfToken: string;
      messages?: string[];
      getFlashMessages: GetFlashMessages;
      error?: any;
    }
    namespace session {
      interface SessionData {
        messages?: string[];
      }
    }
  }
}

export class Server extends CliAppModule {
  async initCli(cli: Cli) {
    const { program } = cli;
    program
      .command("serve")
      .description("start the web application server")
      .action(this.commandServe.bind(this));
    return this;
  }

  async commandServe() {
    const { log } = this;
    const { config } = this.app;

    const host = config.get("host");
    const port = config.get("port");

    const app = await this.buildServer();
    app.listen(port, () => {
      log.info(`Server listening on port ${port}`);
    });
  }

  async buildServer() {
    const { log } = this;
    const { config, services } = this.app;

    // TODO: this seems hacky? maybe should live in services.sessions?
    setInterval(
      () => services.sessions.expireSessions(),
      config.get("sessionExpirationInterval")
    );

    const app = express();
    app.use(pinoHttp({ logger: log }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());
    await this.setupSessions(app);
    await this.setupFlashMessages(app);
    await this.setupCSRFTokens(app);
    await setupAuth(this, app);
    await this.setupRouters(app);
    await this.setupErrorHandler(app);

    return app;
  }

  async setupSessions(app: Express) {
    const { config, services } = this.app;
    const sessionSecret = config.get("sessionSecret");

    app.use(
      session({
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false }, // TODO: need option to enable https in prod
        store: await services.sessions.buildStore(),
      })
    );
    app.use(function (req, res, next) {
      if (req.session.messages?.length) {
        res.locals.messages = req.session.messages;
        req.session.messages = [];
      }
      next();
    });
  }

  async setupFlashMessages(app: Express) {
    const { config } = this.app;
    const sessionKeytFlashMessages = config.get("sessionKeyFlashMessages");

    app.use(flash({ sessionKeyName: sessionKeytFlashMessages }));
    app.use(function (req, res, next) {
      // HACK: copy flash method for compat with Passport
      req.flash = res.flash;
      const localsGetFlashMessages: GetFlashMessages = (type) =>
        getFlashMessages(req, sessionKeytFlashMessages, type);
      res.locals.getFlashMessages = localsGetFlashMessages;
      next();
    });
  }

  async setupCSRFTokens(app: Express) {
    app.use(csrf());
    app.use(function (req, res, next) {
      res.locals.csrfToken = req.csrfToken();
      next();
    });
  }

  async setupRouters(app: Express) {
    const { config } = this.app;

    app.use(express.static(config.get("publicPath")));
    app.use("/", homeRouter(this, app));
    app.use("/auth", authRouter(this, app));
  }

  async setupErrorHandler(app: Express) {
    const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
      res.locals.error = error;
      renderWithLocals(templateError)(req, res, next);
    };
    app.use(errorHandler);
  }
}
