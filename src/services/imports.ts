import { BaseRepository } from "../repositories/base";
import { BaseService, MinimalLogger } from "./base";
import { BookmarkEditable, BookmarksService } from "./bookmarks";

export class ImportService extends BaseService {
  bookmarks: BookmarksService;
  log: MinimalLogger;

  constructor(
    repository: BaseRepository,
    bookmarks: BookmarksService,
    log: MinimalLogger
  ) {
    super(repository);
    this.bookmarks = bookmarks;
    this.log = log;
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
      const batch: BookmarkEditable[] = importRecords
        .slice(startIdx, startIdx + batchSize)
        .map(({ href, description, extended, time, tags, shared }) => {
          const date = new Date(time);
          return {
            ownerId,
            href,
            title: description,
            extended: extended,
            tags,
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
