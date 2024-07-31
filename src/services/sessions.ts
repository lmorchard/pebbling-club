import { Store, SessionData } from "express-session";
import { BaseRepository } from "../repositories/base";
import { BaseService } from "./base";
import { App } from "../app";

export class SessionsService extends BaseService {
  sessionsMaxAge: number;

  constructor(app: App) {
    super(app);
    this.sessionsMaxAge = app.config.get("sessionMaxAge");
  }

  async buildStore() {
    return new ServiceStore(this);
  }

  async expireSessions() {
    await this.repository.deleteExpiredSessions(this.sessionsMaxAge);
  }
}

export class ServiceStore extends Store {
  parent: SessionsService;

  constructor(parent: SessionsService) {
    super();
    this.parent = parent;
  }

  async get(
    sid: string,
    callback: (err: any, session?: SessionData | null) => void
  ) {
    try {
      const result = await this.parent.repository.getSession(sid);
      if (result?.session) {
        const sessionObject = JSON.parse(result.session);
        return callback(null, sessionObject);
      }
    } catch (err) {
      return callback(err, undefined);
    }
    return callback(null, undefined);
  }

  async _put(
    sid: string,
    session: SessionData,
    callback?: (err?: any) => void
  ) {
    try {
      const modified = new Date();
      const sessionData = JSON.stringify(session);
      await this.parent.repository.putSession(sid, sessionData, modified);
      return callback?.(null);
    } catch (err) {
      return callback?.(err);
    }
  }

  async set(sid: string, session: SessionData, callback?: (err?: any) => void) {
    return this._put(sid, session, callback);
  }

  async touch(sid: string, session: SessionData, callback?: () => void) {
    return this._put(sid, session, callback);
  }

  async destroy(sid: string, callback?: (err?: any) => void) {
    try {
      await this.parent.repository.deleteSession(sid);
      return callback?.(null);
    } catch (err) {
      return callback?.(err);
    }
  }
}
