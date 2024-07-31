import { App } from ".";
import { BaseRepository } from "../repositories/base";

export interface BaseApp {
  config: BaseConfig;
  logging: BaseLogger;
  events: BaseEvents;
  repository: BaseRepository;
}

export interface BaseAppModule {
  app: BaseApp;
  init(): Promise<this>;
  deinit(): Promise<this>;
}

export interface BaseConfig {
  // TODO: this is too generic? discards the type assist of Convict
  get(name: any): any;
  set(name: string, value: any): void;
  has(name: string): boolean;
}

export interface BaseEvents {
  on(eventName: string | Symbol, handler: (...args: any[]) => any): number;
  off(eventName: string | Symbol, id: number): void;
  emit(eventName: string | Symbol, ...data: any[]): Promise<any[]>;
}

export interface BaseLogger {
  child: (bindings: Record<string, any>) => BaseLogger;
  trace: (data: Record<string, any>) => void;
  debug: (data: Record<string, any>) => void;
  info: (data: Record<string, any>) => void;
  warn: (data: Record<string, any>) => void;
  error: (data: Record<string, any>) => void;
}
