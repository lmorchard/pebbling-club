import { Readable } from "stream";
import { ImportService } from ".";
import { BookmarkCreatable } from "../bookmarks";

export async function importPinboardJSON(
  this: ImportService,
  ownerId: string,
  batchSize: number,
  importFileStream: Readable
) {
  const { log } = this;
  const { bookmarks } = this;
  const now = new Date();

  // TODO: can this be done easier? or maybe processing the stream as
  // it comes in without loading it all into memory?
  const chunks = [];
  for await (const chunk of importFileStream) {
    chunks.push(Buffer.from(chunk));
  }
  const importData = Buffer.concat(chunks).toString("utf-8");
  const importRecords: PinboardImportRecord[] = JSON.parse(importData);

  const recordCount = importRecords.length;
  log.info({ msg: "loaded exported bookmarks", ownerId, recordCount });

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
          tags: [...tags.split(/ /g), "import:pinboard"],
          visibility: shared == "yes" ? "public" : "private",
          created: date,
          modified: now,
        };
      });
    await bookmarks.upsertBatch(batch);
    importedCount += batch.length;
  }
  return importedCount;
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
