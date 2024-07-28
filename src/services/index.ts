import { App } from "../app";
import { AppModule } from "../app/modules";
import { PasswordService } from "./passwords";

export class Services extends AppModule {
  passwords: PasswordService;

  constructor(app: App) {
    super(app);
    this.passwords = new PasswordService(app.repository);
  }
}
