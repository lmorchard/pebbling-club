import { Cli } from "../app/cli";
import { CliAppModule } from "../app/modules";

import express, { Express, ErrorRequestHandler } from "express";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import session from "express-session";
import flash, { getFlashMessages } from "express-flash-message";
import csrf from "csurf";

import authInit from "./auth";

import homeRouter from "./home/router";
import authRouter from "./auth/router";
import { renderWithLocals } from "./utils/templates";
import templateError from "./templates/error";

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

const SESSION_KEY_FLASH_MESSAGES = "express-flash-message";

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
    const { log } = this;
    const { config, services } = this.app;

    const host = config.get("host");
    const port = config.get("port");
    const sessionSecret = config.get("sessionSecret");

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

    app.use(flash({ sessionKeyName: SESSION_KEY_FLASH_MESSAGES }));
    app.use(function (req, res, next) {
      // HACK: copy flash method for compat with Passport
      req.flash = res.flash;
      const localsGetFlashMessages: GetFlashMessages = (type) =>
        getFlashMessages(req, SESSION_KEY_FLASH_MESSAGES, type);
      res.locals.getFlashMessages = localsGetFlashMessages;
      next();
    });

    app.use(csrf());
    app.use(function (req, res, next) {
      res.locals.csrfToken = req.csrfToken();
      next();
    });

    await authInit(this, app);

    app.use(express.static(config.get("publicPath")));
    app.use("/", homeRouter(this, app));
    app.use("/auth", authRouter(this, app));

    const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
      res.locals.error = error;
      renderWithLocals(templateError)(req, res, next);
    };
    app.use(errorHandler);

    app.listen(port, () => {
      log.info(`Server listening on port ${port}`);
    });
  }
}
