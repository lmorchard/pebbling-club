import { Cli } from "../app/cli";
import { CliAppModule } from "../app/modules";

import express, { Express, ErrorRequestHandler } from "express";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import flash, { getFlashMessages } from "express-flash-message";
import csrf from "csurf";
import { renderWithLocals } from "./utils/templates";
import templateError from "./templates/error";
import { App } from "../app";
import { BaseAppWithServices } from "../app/types";

import homeRouter from "./routers/home";
import authRouter from "./routers/auth";
import profileRouter from "./routers/profile"
import { Boom } from "@hapi/boom";

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
  sessionMaxAge: {
    doc: "Maximum age for sessions",
    env: "SESSION_MAX_AGE",
    format: Number,
    default:  1000 * 60 * 60 * 24 * 7,
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
    interface User {
      id: string;
      username: string;
    }
    interface Locals {
      user?: Express.User;
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

export default class Server extends CliAppModule {
  app: BaseAppWithServices;

  constructor(app: BaseAppWithServices) {
    super(app);
    this.app = app;
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
    const { config, services } = this.app as App;

    // TODO: this seems hacky? maybe should live in services.sessions?
    setInterval(
      () => services.sessions.expireSessions(),
      config.get("sessionExpirationInterval")
    );

    const app = express();
    app.use(pinoHttp({ logger: log as App["logging"]["logger"] }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());
    await this.setupSessions(app);
    await this.setupFlashMessages(app);
    await this.setupCSRFTokens(app);
    await this.setupAuth(app);
    await this.setupRouters(app);
    await this.setupErrorHandler(app);

    return app;
  }

  async setupSessions(app: Express) {
    const { config, services } = this.app as App;
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

  async setupAuth(app: Express) {
    const { log } = this;
    const { passwords, profiles } = this.app.services;

    passport.use(
      new LocalStrategy(async function verify(username, password, cb) {
        try {
          // First, verify the username and password
          const passwordId = await passwords.verify(username, password);
          if (!passwordId) return cb(null, false);

          // Then, get the profile associated with the username
          const profile = await profiles.getByUsername(username);
          if (!profile?.id) return cb(null, false);

          return cb(null, { id: profile.id, username });
        } catch (err) {
          return cb(err);
        }
      })
    );

    // TODO: rework this not to hit the DB? maybe lazy load?
    passport.deserializeUser(async function (id: string, cb) {
      try {
        const profile = await profiles.get(id);
        if (!profile?.username) return cb(null, null);
        return cb(null, { id, username: profile.username });
      } catch (err) {
        cb(err);
      }
    });

    passport.serializeUser(function (user, cb) {
      process.nextTick(function () {
        cb(null, user.id);
      });
    });

    app.use(passport.authenticate("session"));

    app.use(function (req, res, next) {
      res.locals.user = req.user;
      next();
    });
  }

  async setupRouters(app: Express) {
    const { config } = this.app;

    app.use(express.static(config.get("publicPath")));
    app.use("/auth", authRouter(this, app));
    app.use("/u", profileRouter(this, app));
    app.use("/", homeRouter(this, app));
  }

  async setupErrorHandler(app: Express) {
    const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
      res.locals.error = error;
      if (error instanceof Error) {
        if (error instanceof Boom) {
          if (error.output.statusCode === 404) {
            // TODO: need a specific 404 page template
            return res.status(404).send("Not found");
          }
        }
      }
      renderWithLocals(templateError)(req, res, next);
    };
    app.use(errorHandler);
  }
}
