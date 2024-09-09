import { CliAppModule } from "../app/modules";
import { IApp, ICliApp } from "../app/types";
import { PasswordService } from "../services/passwords";
import { ProfileService } from "../services/profiles";

export type IAppRequirements = IApp & {
  services: {
    profiles: ProfileService;
    passwords: PasswordService;
  };
};

export default class CliProfiles extends CliAppModule {
  app: IAppRequirements;

  constructor(app: IAppRequirements) {
    super(app);
    this.app = app;
  }

  async initCli(app: ICliApp) {
    const { program } = app;

    const profilesProgram = program
      .command("profiles")
      .description("manage profiles");

    profilesProgram
      .command("list")
      .description("list all profiles")
      .action(this.commandList.bind(this));

    profilesProgram
      .command("delete <username>")
      .description("delete a profile")
      .action(this.commandDelete.bind(this));

    profilesProgram
      .command("create <username> <password>")
      .description("create a profile")
      .action(this.commandCreate.bind(this));

    profilesProgram
      .command("change-password <username> <password>")
      .description("change a user's password")
      .action(this.commandChangePassword.bind(this));

    return this;
  }

  async commandList() {
    const { log } = this;
    const { services } = this.app;
    const { passwords } = services;

    const users = await passwords.list();
    users.forEach((user) => {
      const { id, username } = user;
      log.info({ id, username });
    });
  }

  async commandDelete(username: string) {
    const { log } = this;
    const { profiles, passwords } = this.app.services;

    const existingProfile = await profiles.getByUsername(username);
    if (!existingProfile?.id) {
      log.error({ msg: "profile does not exist", username });
      return;
    }

    await profiles.delete(existingProfile.id);

    log.info({ msg: "deleted profile", username });
  }

  async commandCreate(username: string, password: string) {
    const { log } = this;
    const { profiles } = this.app.services;

    if (await profiles.usernameExists(username)) {
      log.error({ msg: "username already exists", username });
      return;
    }

    const result = await profiles.create({ username }, { password });
    if (result) {
      log.info({ msg: "created user", username });
    } else {
      log.warn({ msg: "failed to create user", username });
    }
  }

  async commandChangePassword(username: string, password: string) {
    const { log } = this;
    const { passwords } = this.app.services;

    const result = await passwords.update(username, password);
    if (result) {
      log.info({ msg: "updated password", username });
    } else {
      log.warn({ msg: "failed to update password", username });
    }
  }
}
