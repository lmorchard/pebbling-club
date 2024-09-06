import { ReadStream } from "fs";
import * as CSV from "csv";
import { BaseService } from "./base";
import { BookmarkCreatable, BookmarksService } from "./bookmarks";
import { IApp } from "../app/types";

export class ImportService extends BaseService {
  bookmarks: BookmarksService;

  constructor(app: IApp, bookmarks: BookmarksService) {
    super(app);
    this.bookmarks = bookmarks;
  }

  async importPinboard(
    ownerId: string,
    batchSize: number,
    importRecords: PinboardImportRecord[]
  ) {
    const { log } = this;
    const { bookmarks } = this;
    const now = new Date();
    const recordCount = importRecords.length;

    let importedCount = 0;
    for (let startIdx = 0; startIdx < recordCount; startIdx += batchSize) {
      log.debug({
        msg: "importing batch",
        ownerId,
        start: startIdx,
        end: startIdx + batchSize,
        percent: Math.floor((startIdx / recordCount) * 10000) / 100,
      });
      const batch: BookmarkCreatable[] = importRecords
        .slice(startIdx, startIdx + batchSize)
        .map(({ href, description, extended, time, tags, shared }) => {
          const date = new Date(time);
          return {
            ownerId,
            href,
            title: description,
            extended: extended,
            tags: tags.split(/ /g),
            visibility: shared == "yes" ? "public" : "private",
            created: date,
            modified: now,
          };
        });
      await bookmarks.createBatch(batch);
      importedCount += batch.length;
    }
    return importedCount;
  }

  async importRaindropCsv(
    ownerId: string,
    batchSize: number,
    importFileStream: ReadStream
  ) {
    const { log } = this;
    const { bookmarks } = this;

    let importedCount = 0;
    const writeQueue: BookmarkCreatable[] = [];

    // This is maybe over-engineered, but: To avoid reading the whole file
    // into memory while parsing CSV, pause the stream every time we have
    // enough queued up for a batch and then unpause the scream after the
    // batch upsert transaction completes. 

    const csvParser = CSV.parse();
    importFileStream.pipe(csvParser);

    let doneParsing = false;
    csvParser.on("end", () => (doneParsing = true));

    csvParser.on("error", (error) => {
      log.error({ msg: "parsing failed", error });
      doneParsing = true;
    });

    let columns: string[] | null = null;

    csvParser.on("data", async (chunk: string[]) => {
      if (!columns) {
        columns = chunk;
        return;
      }

      const { title, url, tags, created, excerpt, note, highlights } =
        Object.fromEntries(
          columns.map((columnName, i) => [columnName, chunk[i]])
        ) as RaindropCsvRow;

      const newBookmark: BookmarkCreatable = {
        ownerId,
        title,
        href: url,
        tags: tags.split(/, +/g),
        created: new Date(created),
        extended: [note, highlights, excerpt].filter((s) => !!s).join("\n"),
      };

      writeQueue.push(newBookmark);
      if (writeQueue.length >= batchSize && !csvParser.isPaused()) {
        log.debug({ msg: "parsed batch", queued: writeQueue.length });
        csvParser.pause();
      }
    });

    const wait = (delay: number) =>
      new Promise((resolve) => setTimeout(resolve, delay));

    while (!doneParsing || writeQueue.length > 0) {
      if (doneParsing || writeQueue.length >= batchSize) {
        const batch = writeQueue.splice(0, batchSize);
        const result = await bookmarks.createBatch(batch);

        importedCount += result.length;
        log.debug({
          msg: "imported batch",
          importedCount,
          doneParsing,
        });
      } else {
        if (csvParser.isPaused()) csvParser.resume();
        await wait(10);
      }
    }

    return importedCount;
  }
}

export type PinboardImportRecord = {
  href: string;
  description: string;
  extended: string;
  meta: string;
  hash: string;
  time: string;
  shared: string;
  toread: string;
  tags: string;
};

type RaindropCsvRow = Record<
  | "id"
  | "title"
  | "note"
  | "excerpt"
  | "url"
  | "folder"
  | "tags"
  | "created"
  | "cover"
  | "highlights"
  | "favorite",
  string
>;
