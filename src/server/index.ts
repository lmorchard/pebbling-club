import path from "path";
import { URL } from "url";

import { Cli } from "../app/cli";
import { CliAppModule } from "../app/modules";

import Fastify, { FastifyBaseLogger, FastifyInstance } from "fastify";
import FastifyStatic from "@fastify/static";
import FastifyAccepts from "@fastify/accepts";
import FastifyCompress from "@fastify/compress";
import FastifyFormbody from "@fastify/formbody";
import FastifySecureSession from "@fastify/secure-session";
import FastifyCsrfProtection from "@fastify/csrf-protection";
import AjvErrors from "ajv-errors";

import { Strategy as LocalStrategy } from "passport-local";

import { IApp, IWithServices } from "../app/types";

import { HomeRouter } from "./home";
import { ProfilesRouter } from "./profiles";
import { BookmarksRouter } from "./bookmarks";
import { PassportAuth, AuthRouter } from "./auth";

import { Profile } from "../services/profiles";
import { TemplateRenderer } from "./utils/templates";

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
  sessionKey: {
    doc: "Web session key (in hex)",
    env: "SESSION_KEY_HEX",
    format: String,
    default: "4ee2ebdc267f8f637999489a5fbbfbc2ea448353c30928b29019e209aa796f9b",
  },
  sessionMaxAge: {
    doc: "Maximum age for sessions",
    env: "SESSION_MAX_AGE",
    format: Number,
    default: 1000 * 60 * 60 * 24 * 7,
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
} as const;

declare module "fastify" {
  interface PassportUser extends Profile {}
}

export default class Server extends CliAppModule {
  app: IApp & IWithServices;

  constructor(app: IApp & IWithServices) {
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

    this.setDefaultSiteUrl();

    const server = await this.buildServer();

    // Defer resolution of this method until the server closes, which
    // defers postAction cleanup like closing database connections
    const closePromise = new Promise<void>((resolve, reject) => {
      server.addHook("onClose", (instance, done) => {
        resolve();
        done();
      });
    });

    await server.listen({
      host: config.get("host"),
      port: config.get("port"),
    });

    return closePromise;
  }

  async buildServer() {
    const { config } = this.app;

    const fastify: FastifyInstance = Fastify({
      // HACK: ILogger is not compatible with FastifyBaseLogger, though really it is - fix this
      logger: this.log as FastifyBaseLogger,
      ajv: { customOptions: { allErrors: true }, plugins: [AjvErrors] },
    });

    fastify.register(FastifyCompress);
    fastify.register(FastifyAccepts);
    fastify.register(FastifyFormbody);
    await this.setupSessions(fastify);
    fastify.register(FastifyCsrfProtection, {
      sessionPlugin: "@fastify/secure-session",
    });
    fastify.register(PassportAuth, { services: this.app.services });
    fastify.register(TemplateRenderer);
    await this.setupRouters(fastify);

    return fastify;
  }

  async setupSessions(server: FastifyInstance) {
    const { config } = this.app;
    server.register(FastifySecureSession, {
      // TODO: get from config!
      key: Buffer.from(config.get("sessionKey"), "hex"),
      expiry: config.get("sessionMaxAge"),
      cookie: { path: "/" },
    });
  }

  async setupRouters(server: FastifyInstance) {
    const { config } = this.app;

    server.register(FastifyStatic, {
      root: path.resolve(config.get("publicPath")),
      prefix: "/",
    });
    server.register(ProfilesRouter, { server: this, prefix: "/u/" });
    server.register(BookmarksRouter, { server: this, prefix: "/" });
    server.register(AuthRouter, { server: this, prefix: "/" });
    server.register(HomeRouter, { server: this, prefix: "/" });
  }

  setDefaultSiteUrl() {
    const { log } = this;
    const { config } = this.app;

    if (config.get("siteUrl")) return;

    const projectId = config.get("projectId");
    const projectDomain = config.get("projectDomain");
    if (projectDomain && projectId) {
      // HACK: Having PROJECT_DOMAIN and PROJECT_ID set are a good indication
      // to try auto-configuring the siteUrl for a Glitch project
      const siteUrl = `https://${projectDomain}.glitch.me`;
      log.trace({ msg: "Using Glitch site URL", siteUrl });
      return config.set("siteUrl", siteUrl);
    }

    const host = config.get("host");
    const port = config.get("port");
    const siteUrl = new URL(`http://${host}:${port}`).toString();
    log.trace({ msg: "Using default site URL", siteUrl });
    config.set("siteUrl", siteUrl);
  }
}
