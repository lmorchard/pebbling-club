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

    const host = config.get("host");
    const port = config.get("port");
    const sessionSecret = config.get("sessionSecret");

    const app = express();

    app.use(pinoHttp({ logger: log }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());

    /*
    if (app.get('env') === 'production') {
      app.set('trust proxy', 1) // trust first proxy
      sess.cookie.secure = true // serve secure cookies
    }
    */

    app.use(
      session({
        secret: sessionSecret,
        resave: false, // don't save session if unmodified
        saveUninitialized: false, // don't create session until something stored
        // cookie: { secure: true }, // todo: enable for HTTPS
        // store: new SQLiteStore({ db: 'sessions.db', dir: './var/db' }) // todo: build a session service and store subclass
      })
    );
    app.use(csrf());
    app.use(function (req, res, next) {
      // @ts-ignore
      const user = req.session?.passport?.user;
      const csrfToken = req.csrfToken();
      res.locals.globalProps = {
        user,
        csrfToken,
      };
      next();
    });
    /*
    app.use(function(req, res, next) {
      var msgs = req.session.messages || [];
      res.locals.messages = msgs;
      res.locals.hasMessages = !! msgs.length;
      req.session.messages = [];
      next();
    });
    */

    app.use(express.static(config.get("publicPath")));

    await authInit(this, app);

    app.use("/", indexRouter());

    app.listen(port, () => {
      log.info(`Server listening on port ${port}`);
    });
  }
}
