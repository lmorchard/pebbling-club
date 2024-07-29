import { App } from "../app";
import { AppModule } from "../app/modules";
import { PasswordService } from "./passwords";
import { SessionsService } from "./sessions";

export class Services extends AppModule {
  passwords: PasswordService;
  sessions: SessionsService;

  constructor(app: App) {
    super(app);
    
    const { repository } = app;
    this.passwords = new PasswordService(repository);
    this.sessions = new SessionsService(repository);
  }
}
