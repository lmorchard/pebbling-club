import * as dotenv from "dotenv";
import Convict from "convict";
import { CliAppModule } from "./modules";
import { IApp, ICliApp, IConfig } from "./types";
import { Command } from "commander";

import { configSchema as loggingConfigSchema } from "./logging";
import { configSchema as serverConfigSchema } from "../web/index";
import { configSchema as repositorySqliteConfigSchema } from "../repositories/sqlite/main/index";
import { configSchema as repositorySqliteFeedsConfigSchema } from "../repositories/sqlite/feeds/index";
import { configSchema as repositorySqliteFetchConfigSchema } from "../repositories/sqlite/fetch/index";
import { configSchema as fetchConfigSchema } from "../services/fetch";
import { configSchema as feedsConfigSchema } from "../services/feeds";

// HACK: Hardcoded assemblage of all configuration schemas, would be nice
// if was dynamic at run-time
export const configSchema = {
  ...loggingConfigSchema,
  ...serverConfigSchema,
  ...repositorySqliteConfigSchema,
  ...repositorySqliteFeedsConfigSchema,
  ...repositorySqliteFetchConfigSchema,
  ...fetchConfigSchema,
  ...feedsConfigSchema
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

  async initCli(program: Command) {
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
      const { doc, default: defaultValue } = defn;
      const currentValue = props[name as keyof typeof props];
      log.info({ configName: name, doc, defaultValue, currentValue });
    }
  }
}
