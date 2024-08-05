import path from "path";
import fs from "fs/promises";
import { URL } from "url";

import { Cli } from "../app/cli";
import { CliAppModule } from "../app/modules";

import Fastify, {
  FastifyBaseLogger,
  FastifyInstance,
  FastifyPluginAsync,
} from "fastify";
import FastifyStatic from "@fastify/static";
import FastifyAccepts from "@fastify/accepts";
import FastifyCompress from "@fastify/compress";
import FastifyFormbody from "@fastify/formbody";
import FastifySecureSession from "@fastify/secure-session";
import FastifyPassport from "@fastify/passport";
import FastifyFlash from "@fastify/flash";
import FastifyCsrfProtection from "@fastify/csrf-protection";
// import FastifyWebsocket from "@fastify/websocket";
import AjvErrors from "ajv-errors";

import { Strategy as LocalStrategy } from "passport-local";

import { IApp, IWithServices } from "../app/types";

import HomeRouter from "./routers/home";
import AuthRouter from "./routers/auth";
import ProfileRouter from "./routers/profile";

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
    // const { routes, websockets } = this;

    const fastify: FastifyInstance = Fastify({
      // HACK: ILogger is not compatible with FastifyBaseLogger, though really it is - fix this
      logger: this.log as FastifyBaseLogger,
      ajv: { customOptions: { allErrors: true }, plugins: [AjvErrors] },
    });

    fastify.register(FastifyCompress);
    fastify.register(FastifyAccepts);
    fastify.register(FastifyFormbody);
    await this.setupSessions(fastify);
    // fastify.register(FastifyFlash);
    fastify.register(FastifyCsrfProtection, {
      sessionPlugin: "@fastify/secure-session",
    });
    await this.setupAuth(fastify);
    fastify.register(TemplateRenderer);
    //fastify.register(FastifyWebsocket)
    //fastify.register(async (server) => websockets.extendServer(server))
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

  async setupAuth(server: FastifyInstance) {
    const { passwords, profiles } = this.app.services;

    server.register(FastifyPassport.initialize());
    server.register(FastifyPassport.secureSession());

    FastifyPassport.use(
      "local",
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

    FastifyPassport.registerUserSerializer(
      async (user: Profile, request) => user.id
    );

    FastifyPassport.registerUserDeserializer(async (id: string, request) => {
      const profile = await profiles.get(id);
      if (!profile?.username) return null;
      return profile;
    });
  }

  async setupRouters(server: FastifyInstance) {
    const { config } = this.app;

    server.register(FastifyStatic, {
      root: path.resolve(config.get("publicPath")),
      prefix: "/",
    });
    server.register(ProfileRouter, { server: this, prefix: "/u/" });
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
