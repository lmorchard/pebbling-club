import { AppModule } from "./modules";
import { IApp, IEvents } from "./types";

export type EventName = string | Symbol
export type EventHandler = (...args: any[]) => any;
export type EventSubscriptionId = number;
export type SubscriptionsForEvent = Map<number, EventHandler>;

export class Events extends AppModule implements IEvents {
  lastId: number;
  subscriptions: Map<EventName, SubscriptionsForEvent>;

  constructor(app: IApp) {
    super(app);
    this.subscriptions = new Map();
    this.lastId = 0;
  }

  getSubscriptionsForEvent(eventName: EventName): SubscriptionsForEvent {
    if (!this.subscriptions.has(eventName)) {
      this.subscriptions.set(eventName, new Map());
    }
    return this.subscriptions.get(eventName) as SubscriptionsForEvent;    
  }

  on(eventName: EventName, handler: EventHandler): EventSubscriptionId {
    const id = this.lastId++;
    const subscriptions = this.getSubscriptionsForEvent(eventName);
    subscriptions.set(id, handler);
    return id;
  }

  off(eventName: EventName, id: EventSubscriptionId) {
    const subscriptions = this.getSubscriptionsForEvent(eventName);
    subscriptions.delete(id);
  }

  async emit(eventName: EventName, ...data: any[]) {
    const subscriptions = this.getSubscriptionsForEvent(eventName);
    const results = [];
    for (const handler of subscriptions.values()) {
      results.push(handler(...data));
    }
    return Promise.all(results);
  }
}