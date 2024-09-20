import * as CSV from "csv";

import { Readable } from "stream";
import { ImportService } from ".";
import { BookmarkCreatable } from "../bookmarks";

export async function importRaindropCSV(
  this: ImportService,
  ownerId: string,
  batchSize: number,
  importFileStream: Readable
) {
  const { log } = this;
  const { bookmarks } = this.app;

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
      tags: [...tags.split(/, +/g), "imported:raindrop"],
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
      const result = await bookmarks.upsertBatch(batch);

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
