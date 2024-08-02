import { Services } from "../services";

export interface IApp {
  config: IConfig;
  logging: ILogger;
  events: IEvents;
}

// TODO: rather tied to the specific set of services, find a way to make more generic?
export interface IWithServices {
  services: Services;
}

export interface IAppModule {
  app: IApp;
  init(): Promise<this>;
  deinit(): Promise<this>;
}

export interface IConfig {
  // TODO: this is too generic? discards the type assist of Convict
  get(name: any): any;
  set(name: string, value: any): void;
  has(name: string): boolean;
}

export interface IEvents {
  on(eventName: string | Symbol, handler: (...args: any[]) => any): number;
  off(eventName: string | Symbol, id: number): void;
  emit(eventName: string | Symbol, ...data: any[]): Promise<any[]>;
}

export interface ILogger {
  child: (bindings: Record<string, any>) => ILogger;
  trace: (data: string | Record<string, any>) => void;
  debug: (data: string | Record<string, any>) => void;
  info: (data: string | Record<string, any>) => void;
  warn: (data: string | Record<string, any>) => void;
  error: (data: string | Record<string, any>) => void;
}
