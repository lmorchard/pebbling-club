import { IApp, IConfig, IEvents, ILogger } from "./types";

export class MockConfig implements IConfig {
  get(name: any): any {
    return null;
  }
  set(name: string, value: any): void {
    return;
  }
  has(name: string): boolean {
    return false;
  }
}

export class MockLogging implements ILogger {
  child(bindings: Record<string, any>): ILogger {
    return this;
  }
  trace(data: string | Record<string, any>): void {
    return;
  }
  debug(data: string | Record<string, any>): void {
    return;
  }
  info(data: string | Record<string, any>): void {
    return;
  }
  warn(data: string | Record<string, any>): void {
    return;
  }
  error(data: string | Record<string, any>): void {
    return;
  }
}

export class MockEvents implements IEvents {
  on(eventName: string | Symbol, handler: (...args: any[]) => any): number {
    return 0;
  }
  off(eventName: string | Symbol, id: number): void {
    return;
  }
  emit(eventName: string | Symbol, ...data: any[]): Promise<any[]> {
    return Promise.resolve([]);
  }
}

export class MockApp implements IApp {
  config: IConfig;
  logging: ILogger;
  events: IEvents;

  constructor() {
    this.config = new MockConfig();
    this.logging = new MockLogging();
    this.events = new MockEvents();
  }
}
