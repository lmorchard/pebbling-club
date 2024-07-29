import stream from "stream";
import pino, { Logger } from "pino";
import pretty from "pino-pretty";

import { App } from ".";
import { CliAppModule } from "./modules";
import { Events } from "./events";
import { Cli } from "./cli";
import { Command } from "commander";

export const configSchema = {
  logLevel: {
    doc: "Logging level",
    env: "LOG_LEVEL",
    format: ["trace", "debug", "info", "warn", "error"],
    default: "debug",
  },
  logSingleLine: {
    doc: "Emit single-line log messages",
    env: "LOG_SINGLE_LINE",
    format: Boolean,
    default: true,
  },
} as const;

export class Logging extends CliAppModule {
  static EVENT_LOG = Symbol("eventLog");

  usePrettyLogs: boolean;
  log: Logger<never>;

  constructor(app: App) {
    super(app);
    this.usePrettyLogs = false;
    this.log = this.buildLogger();
  }

  async init() {
    return this;
  }

  async initCli(cli: Cli) {
    const { program } = cli;
    program.option(
      "--no-pretty-logs",
      "disable pretty printing of logs in a TTY"
    );
    program.option("-C, --force-pretty-logs", "enable pretty printing of logs");
    program.hook("preAction", this.preCliAction.bind(this));
    return this;
  }

  async preCliAction(command: Command) {
    const { prettyLogs, forcePrettyLogs } = command.opts();
    this.usePrettyLogs =
      forcePrettyLogs || (process.stdout.isTTY && prettyLogs);
    // HACK: rebuild logger to account for usePrettyLogs
    this.log = this.buildLogger();
  }

  buildLogger() {
    const { usePrettyLogs } = this;
    const config = this.app.config.config;

    const logStreams = [
      {
        stream: usePrettyLogs
          ? pretty({
              colorize: true,
              singleLine: config.get("logSingleLine"),
            })
          : process.stdout,
      },
      { stream: new LogEventStream(this.app.events, Logging.EVENT_LOG) },
    ];
    const logOptions = {
      level: config.get("logLevel"),
    };
    return pino(logOptions, pino.multistream(logStreams));
  }
}

class LogEventStream extends stream.Writable {
  events: Events;
  eventName: Symbol;

  constructor(events: Events, eventName: Symbol) {
    super();
    this.events = events;
    this.eventName = eventName;
  }
  _write(chunk: Buffer, enc: string, next: () => void) {
    try {
      this.events.emit(this.eventName, JSON.parse(chunk.toString()));
    } catch {
      /* no-op */
    }
    next();
  }
}
