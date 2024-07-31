import fs from "fs/promises";
import { Cli } from "../app/cli";
import { CliAppModule } from "../app/modules";
import { PinboardImportRecord } from "../services/imports";
import { BaseAppWithServices } from "../app/types";

export default class CliImport extends CliAppModule {
  app: BaseAppWithServices;

  constructor(app: BaseAppWithServices) {
    super(app);
    this.app = app;
  }

  async initCli(cli: Cli) {
    const { program } = cli;

    const importProgram = program.command("import").description("import data");

    importProgram
      .command("pinboard <username> <filename>")
      .description("import a pinboard JSON export")
      .option(
        "-b, --batch <count>",
        "number of bookmarks to import per transaction batch"
      )
      .action(this.commandPinboard.bind(this));

    return this;
  }

  async commandPinboard(
    username: string,
    filename: string,
    options: { batch: string }
  ) {
    const { log } = this;
    const { passwords, imports } = this.app.services;
    const batchSize = parseInt(options.batch, 10) || 100;

    const ownerId = await passwords.getIdByUsername(username);
    if (!ownerId) throw new Error("user not found");

    log.debug({ msg: "loading exported bookmarks", ownerId });
    const importData = await fs.readFile(filename, "utf-8");
    const importRecords: PinboardImportRecord[] = JSON.parse(importData);

    const recordCount = importRecords.length;
    log.info({ msg: "loaded exported bookmarks", ownerId, recordCount });

    log.debug({ msg: "importing bookmarks", ownerId, batchSize });
    const importedCount = await imports.importPinboard(
      ownerId,
      batchSize,
      importRecords
    );
    log.info({ msg: "imported bookmarks", ownerId, importedCount });
  }
}
