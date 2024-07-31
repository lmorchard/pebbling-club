import { BaseApp, BaseConfig, BaseEvents, BaseLogger } from "./types";
import { BaseRepository } from "../repositories/base";

export class MockConfig implements BaseConfig {
  get (name: any): any {
    return null;
  }
  set (name: string, value: any): void {
    return;
  }
  has (name: string): boolean {
    return false;
  }
}

export class MockLogging implements BaseLogger {
  child (bindings: Record<string, any>): BaseLogger {
    return this;
  }
  trace (data: string | Record<string, any>): void {
    return;
  }
  debug (data: string | Record<string, any>): void {
    return;
  }
  info (data: string | Record<string, any>): void {
    return;
  }
  warn (data: string | Record<string, any>): void {
    return;
  }
  error (data: string | Record<string, any>): void {
    return;
  }
}

export class MockEvents implements BaseEvents {
  on (eventName: string | Symbol, handler: (...args: any[]) => any): number {
    return 0;
  }
  off (eventName: string | Symbol, id: number): void {
    return;
  }
  emit (eventName: string | Symbol, ...data: any[]): Promise<any[]> {
    return Promise.resolve([]);
  }
}

// @ts-ignore not implementing a full repository, stub out methods as needed in tests
export class MockRepository implements BaseRepository {
}

export class MockApp implements BaseApp {
  config: BaseConfig;
  logging: BaseLogger;
  events: BaseEvents;
  repository: BaseRepository;

  constructor() {
    this.config = new MockConfig();
    this.logging = new MockLogging();
    this.events = new MockEvents();
    // @ts-ignore not implementing a full repository, stub out methods as needed in tests
    this.repository = new MockRepository();
  }
}
