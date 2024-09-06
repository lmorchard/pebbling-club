import fs from "fs/promises";
import { createReadStream } from "fs";
import { Cli } from "../app/cli";
import { CliAppModule } from "../app/modules";
import { PinboardImportRecord } from "../services/imports";
import { IApp, IWithServices } from "../app/types";
import { BookmarkCreatable } from "../services/bookmarks";
import { App } from "../app";

export default class CliImport extends CliAppModule {
  app: IApp & IWithServices;

  constructor(app: IApp & IWithServices) {
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

    importProgram
      .command("raindrop-csv <username> <filename>")
      .description("import a raindrop CSV export")
      .option(
        "-b, --batch <count>",
        "number of bookmarks to import per transaction batch"
      )
      .action(this.commandRaindropCsv.bind(this));

    return this;
  }

  async commandPinboard(
    username: string,
    filename: string,
    options: { batch: string }
  ) {
    const { log } = this;
    const { profiles, imports } = this.app.services;
    const batchSize = parseInt(options.batch, 10) || 100;

    const ownerProfile = await profiles.getByUsername(username);
    if (!ownerProfile?.id) throw new Error("user not found");

    const ownerId = ownerProfile.id;
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

  async commandRaindropCsv(
    username: string,
    filename: string,
    options: { batch: string }
  ) {
    const { log } = this;
    const { services } = this.app as App;
    const { profiles, imports, bookmarks } = services;

    const batchSize = parseInt(options.batch, 10) || 100;

    const ownerProfile = await profiles.getByUsername(username);
    if (!ownerProfile?.id) throw new Error("user not found");

    const ownerId = ownerProfile.id;
    log.debug({ msg: "loading exported bookmarks", ownerId });

    const importFileStream = createReadStream(filename, "utf-8");

    const importedCount = await imports.importRaindropCsv(
      ownerId,
      batchSize,
      importFileStream
    );
    log.info({ msg: "imported bookmarks", ownerId, importedCount });
  }
}
