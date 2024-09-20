import { createReadStream } from "fs";
import { CliAppModule } from "../app/modules";
import { ImportService } from "../services/imports";
import { ProfileService } from "../services/profiles";
import { Readable } from "stream";
import { Command } from "commander";

export type IAppRequirements = {
  profiles: ProfileService;
  imports: ImportService;
};

export default class CliImport extends CliAppModule<IAppRequirements> {
  async initCli(program: Command) {
    const importProgram = program.command("import").description("import data");

    importProgram
      .command("pinboard-json <username> <filename>")
      .description("import a pinboard JSON export")
      .option(
        "-b, --batch <count>",
        "number of bookmarks to import per transaction batch"
      )
      .action(this.commandPinboardJSON.bind(this));

    importProgram
      .command("raindrop-csv <username> <filename>")
      .description("import a raindrop CSV export")
      .option(
        "-b, --batch <count>",
        "number of bookmarks to import per transaction batch"
      )
      .action(this.commandRaindropCSV.bind(this));

    importProgram
      .command("opml <username> <filename>")
      .description("import an OPML file")
      .option(
        "-b, --batch <count>",
        "number of bookmarks to import per transaction batch"
      )
      .action(this.commandOPML.bind(this));
  }

  async commandPinboardJSON(
    username: string,
    filename: string,
    options: { batch: string }
  ) {
    return this.commonImportCommand(username, filename, options, (...args) =>
      this.app.imports.importPinboardJSON(...args)
    );
  }

  async commandRaindropCSV(
    username: string,
    filename: string,
    options: { batch: string }
  ) {
    return this.commonImportCommand(username, filename, options, (...args) =>
      this.app.imports.importRaindropCSV(...args)
    );
  }

  async commandOPML(
    username: string,
    filename: string,
    options: { batch: string }
  ) {
    return this.commonImportCommand(username, filename, options, (...args) =>
      this.app.imports.importOPML(...args)
    );
  }

  async commonImportCommand(
    username: string,
    filename: string,
    options: { batch: string },
    importFn: (
      ownerId: string,
      batchSize: number,
      importFileStream: Readable
    ) => Promise<number>
  ) {
    const { log } = this;
    const { profiles } = this.app;
    const batchSize = parseInt(options.batch, 10) || 100;

    const ownerProfile = await profiles.getByUsername(username);
    if (!ownerProfile?.id) throw new Error("user not found");

    const ownerId = ownerProfile.id;
    log.debug({ msg: "loading exported bookmarks", ownerId });

    const importFileStream = createReadStream(filename, "utf-8");

    log.info({ msg: "importing bookmarks", ownerId, batchSize });
    const importedCount = await importFn(ownerId, batchSize, importFileStream);
    log.info({ msg: "imported bookmarks", ownerId, importedCount });
  }
}
