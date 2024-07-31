import { App } from "../app";
import { Cli } from "../app/cli";
import { CliAppModule } from "../app/modules";
import { BaseAppWithServices } from "../app/types";

export default class CliUsers extends CliAppModule {
  app: BaseAppWithServices;

  constructor(app: BaseAppWithServices) {
    super(app);
    this.app = app;
  }

  async initCli(cli: Cli) {
    const { program } = cli;

    const usersProgram = program.command("users").description("manage users");

    usersProgram
      .command("list")
      .description("list all users")
      .action(this.commandList.bind(this));

    usersProgram
      .command("delete <username>")
      .description("delete a user")
      .action(this.commandDelete.bind(this));

    usersProgram
      .command("create <username> <password>")
      .description("create a user")
      .action(this.commandCreate.bind(this));

    usersProgram
      .command("change-password <username> <password>")
      .description("change a user's password")
      .action(this.commandChangePassword.bind(this));

    return this;
  }

  async commandList() {
    const { log } = this;
    const { services } = this.app as App;
    const { passwords } = services;

    const users = await passwords.list();
    users.forEach((user) => {
      const { id, username } = user;
      log.info({ id, username });
    });
  }

  async commandDelete(username: string) {
    const { log } = this;
    const { passwords } = this.app.services;

    const result = await passwords.delete(username);
    console.log(result);
    if (result) {
      log.info({ msg: "deleted user", username, result });
    } else {
      log.warn({ msg: "failed to delete user", username });
    }
  }

  async commandCreate(username: string, password: string) {
    const { log } = this;
    const { passwords } = this.app.services;

    if (await passwords.usernameExists(username)) {
      log.error({ msg: "username already exists", username });
      return;
    }

    const result = await passwords.create(username, password);
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
