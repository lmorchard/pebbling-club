import { Store, SessionData } from "express-session";
import { BaseService } from "./base";
import { IApp } from "../app/types";

export class SessionsService extends BaseService {
  repository: ISessionsRepository;
  sessionsMaxAge: number;

  constructor(app: IApp, repository: ISessionsRepository) {
    super(app);
    this.repository = repository;

    this.sessionsMaxAge = this.app.config.get("sessionMaxAge");
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

export interface ISessionsRepository {
  deleteSession(sid: string): void;
  deleteExpiredSessions(maxAge: number): void;
  getSession(sid: string): Promise<undefined | { session: string }>;
  putSession(sid: string, sess: string, expiredDate: Date): Promise<void>;
}
