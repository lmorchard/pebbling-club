import { createReadStream } from "fs";
import { CliAppModule } from "../app/modules";
import { ImportService } from "../services/imports";
import { IApp, ICliApp } from "../app/types";
import { ProfileService } from "../services/profiles";

export type IAppRequirements = IApp & {
  services: {
    profiles: ProfileService;
    imports: ImportService;
  };
};

export default class CliImport extends CliAppModule {
  app: IAppRequirements;

  constructor(app: IAppRequirements) {
    super(app);
    this.app = app;
  }

  async initCli(app: ICliApp) {
    const { program } = app;

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
    // TODO fix this type
    const { services } = this.app;
    const { profiles, imports } = services;
    const batchSize = parseInt(options.batch, 10) || 100;

    const ownerProfile = await profiles.getByUsername(username);
    if (!ownerProfile?.id) throw new Error("user not found");

    const ownerId = ownerProfile.id;
    log.debug({ msg: "loading exported bookmarks", ownerId });

    const importFileStream = createReadStream(filename, "utf-8");

    log.debug({ msg: "importing bookmarks", ownerId, batchSize });
    const importedCount = await imports.importPinboardJSON(
      ownerId,
      batchSize,
      importFileStream
    );
    log.info({ msg: "imported bookmarks", ownerId, importedCount });
  }

  async commandRaindropCsv(
    username: string,
    filename: string,
    options: { batch: string }
  ) {
    const { log } = this;
    // TODO fix this type
    const { services } = this.app;
    const { profiles, imports } = services;

    const batchSize = parseInt(options.batch, 10) || 100;

    const ownerProfile = await profiles.getByUsername(username);
    if (!ownerProfile?.id) throw new Error("user not found");

    const ownerId = ownerProfile.id;
    log.debug({ msg: "loading exported bookmarks", ownerId });

    const importFileStream = createReadStream(filename, "utf-8");

    const importedCount = await imports.importRaindropCSV(
      ownerId,
      batchSize,
      importFileStream
    );
    log.info({ msg: "imported bookmarks", ownerId, importedCount });
  }
}
