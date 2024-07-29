import * as dotenv from "dotenv";
import Convict from "convict";
import { App } from "./app";
import { CliAppModule } from "./app/modules";
import { Command } from "commander";
import { Cli } from "./cli";

import { configSchema as loggingConfigSchema } from "./logging";
import { configSchema as serverConfigSchema } from "./server/index";
import { configSchema as repositorySqlite3ConfigSchema } from "./repositories/sqlite/index";

dotenv.config();

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

export const config = Convict(configSchema);

export class Config extends CliAppModule {
  config: typeof config;

  constructor(app: App) {
    super(app);
    this.config = config;
  }

  async initCli(cli: Cli) {
    const { program } = cli;

    program.option(
      "-f, --config-file <path>",
      "load config from specified JSON file"
    );
    program.option("-F, --config <name=value...>", "set configuration values");

    const configProgram = program
      .command("config")
      .description("configuration operations");

    configProgram
      .command("show")
      .description("show current configuration")
      .action(this.commandConfigShow.bind(this));

    return this;
  }

  get(name: keyof typeof configSchema) {
    return this.config.get(name);
  }

  has(name: keyof typeof configSchema) {
    return this.config.get(name);
  }

  set(name: keyof typeof configSchema, value: any) {
    return this.config.set(name, value);
  }

  async preCliAction(thisCommand: Command, actionCommand: Command): Promise<void> {
    const options = thisCommand.opts();
    // Load config from file, if specified
    if (options.configFile) {
      config.loadFile(options.configFile);
    }
  }

  async commandConfigShow() {
    const { log } = this.app.logging;

    const schema = configSchema;
    const props = config.getProperties();

    for (const [name, defn] of Object.entries(schema)) {
      const { doc, env, default: defaultValue } = defn;
      const currentValue = props[name as keyof typeof props];
      log.info({ configName: name, env, doc, defaultValue, currentValue });
    }
  }
}
