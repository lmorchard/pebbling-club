import * as dotenv from "dotenv";
import Convict from "convict";
import { App } from ".";
import { CliAppModule } from "./modules";
import { BaseConfig } from "./types";
import { Command } from "commander";
import { Cli } from "./cli";

import { configSchema as loggingConfigSchema } from "./logging";
import { configSchema as serverConfigSchema } from "../server/index";
import { configSchema as repositorySqlite3ConfigSchema } from "../repositories/sqlite/index";

// HACK: Hardcoded assemblage of all configuration schemas, would be nice
// if was dynamic at run-time
export const configSchema = {
  dataPath: {
    doc: "Data directory for application state",
    env: "DATA_PATH",
    format: String,
    default: "data" as string,
  },
  ...loggingConfigSchema,
  ...serverConfigSchema,
  ...repositorySqlite3ConfigSchema,
} as const;

// Load up the base config from environment and schema
dotenv.config();
export const config = Convict(configSchema);

export class Config extends CliAppModule implements BaseConfig {
  config: typeof config;

  constructor(app: App) {
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
