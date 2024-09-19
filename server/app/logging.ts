import stream from "stream";
import pino, { Logger } from "pino";
import pretty from "pino-pretty";

import { CliAppModule } from "./modules";
import { Command } from "commander";
import { IApp, ICliApp, IEvents } from "./types";

const LOG_LEVELS = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
] as const;

export const configSchema = {
  logLevel: {
    doc: "Logging level",
    env: "LOG_LEVEL",
    format: LOG_LEVELS,
    default: "debug" as (typeof LOG_LEVELS)[number],
  },
  logSingleLine: {
    doc: "Emit single-line log messages",
    env: "LOG_SINGLE_LINE",
    format: Boolean,
    default: false,
  },
} as const;

export class Logging extends CliAppModule {
  static EVENT_LOG = Symbol("eventLog");

  usePrettyLogs: boolean;
  logger: Logger<never>;

  constructor(app: IApp) {
    super(app);
    this.usePrettyLogs = false;
    this.logger = this.buildLogger();
  }

  async init() {
    this.logger = this.buildLogger();
  }

  get child() {
    return this.logger.child.bind(this.logger);
  }

  get trace() {
    return this.logger.trace.bind(this.logger);
  }

  get debug() {
    return this.logger.debug.bind(this.logger);
  }

  get info() {
    return this.logger.info.bind(this.logger);
  }

  get warn() {
    return this.logger.warn.bind(this.logger);
  }

  get error() {
    return this.logger.error.bind(this.logger);
  }

  get fatal() {
    return this.logger.fatal.bind(this.logger);
  }

  async initCli(program: Command) {
    program.option(
      "--no-pretty-logs",
      "disable pretty printing of logs in a TTY"
    );
    program.option("-C, --force-pretty-logs", "enable pretty printing of logs");
    program.hook("preAction", this.preCliAction.bind(this));
  }

  async preCliAction(command: Command) {
    const { prettyLogs, forcePrettyLogs } = command.opts();
    this.usePrettyLogs =
      forcePrettyLogs || (process.stdout.isTTY && prettyLogs);
    // Rebuild logger to account for usePrettyLogs
    this.logger = this.buildLogger();
  }

  buildLogger() {
    const { usePrettyLogs } = this;
    const { config, events } = this.app;
    const options = {
      level: config.get("logLevel"),
    };
    const destinations = pino.multistream([
      {
        level: "trace",
        stream: new LogEventStream(events, Logging.EVENT_LOG),
      },
      {
        level: "trace",
        stream: usePrettyLogs
          ? pretty({
              colorize: true,
              singleLine: config.get("logSingleLine"),
            })
          : process.stdout,
      },
    ]);
    return pino(options, destinations);
  }
}

class LogEventStream extends stream.Writable {
  events: IEvents;
  eventName: Symbol;

  constructor(events: IEvents, eventName: Symbol) {
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
