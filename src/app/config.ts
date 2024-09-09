import * as dotenv from "dotenv";
import Convict from "convict";
import { App } from ".";
import { CliAppModule } from "./modules";
import { IApp, IConfig } from "./types";
import { Command } from "commander";
import { Cli } from "./cli";

import { configSchema as loggingConfigSchema } from "./logging";
import { configSchema as serverConfigSchema } from "../server/index";
import { configSchema as repositorySqlite3ConfigSchema } from "../repositories/sqlite/index";

// HACK: Hardcoded assemblage of all configuration schemas, would be nice
// if was dynamic at run-time
export const configSchema = {
  ...loggingConfigSchema,
  ...serverConfigSchema,
  ...repositorySqlite3ConfigSchema,
} as const;

// Load up the base config from environment and schema
dotenv.config();
export const config = Convict(configSchema);

export class Config extends CliAppModule implements IConfig {
  config: typeof config;

  constructor(app: IApp) {
    super(app);
    this.config = config;
  }

  get get() {
    return this.config.get.bind(this.config);
  }

  get set() {
    return this.config.set.bind(this.config);
  }

  get has() {
    return this.config.has.bind(this.config);
  }

  async init() {
    await this.maybeConfigureForGlitch();
    return this;
  }

  async maybeConfigureForGlitch() {
    const { PROJECT_DOMAIN, PROJECT_NAME, PROJECT_ID } = process.env;
    if (!(PROJECT_DOMAIN && PROJECT_NAME && PROJECT_ID)) return;

    if (!config.get("siteUrl")) {
      const siteUrl = `https://${PROJECT_DOMAIN}.glitch.me`;
      config.set("siteUrl", siteUrl);
    }

    config.set("sqliteDatabasePath", ".data");
  }     

  async initCli(cli: Cli) {
    const { program } = cli;

    program.option(
      "-f, --config-file <path>",
      "load config from specified JSON file"
    );
    program.option("-F, --config <name=value...>", "set configuration values");
    program.hook("preAction", this.preCliAction.bind(this));

    const configProgram = program
      .command("config")
      .description("configuration operations");

    configProgram
      .command("show")
      .description("show current configuration")
      .action(this.commandConfigShow.bind(this));

    return this;
  }

  async preCliAction(
    thisCommand: Command,
    actionCommand: Command
  ): Promise<void> {
    const options = thisCommand.opts();
    // Load config from file, if specified
    if (options.configFile) {
      config.loadFile(options.configFile);
    }
  }

  async commandConfigShow() {
    const { log } = this;

    const schema = configSchema;
    const props = config.getProperties();

    for (const [name, defn] of Object.entries(schema)) {
      const { doc, env, default: defaultValue } = defn;
      const currentValue = props[name as keyof typeof props];
      log.info({ configName: name, env, doc, defaultValue, currentValue });
    }
  }
}
