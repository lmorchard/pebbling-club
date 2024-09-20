import { Readable } from "stream";
import { ImportService } from ".";
import { BookmarkCreatable } from "../bookmarks";
import opml from "opml";

export async function importOPML(
  this: ImportService,
  ownerId: string,
  batchSize: number,
  importFileStream: Readable
) {
  const { log } = this;
  const { bookmarks } = this.app;
  const now = new Date();

  // TODO: can this be done easier? or maybe processing the stream as
  // it comes in without loading it all into memory?
  const chunks = [];
  for await (const chunk of importFileStream) {
    chunks.push(Buffer.from(chunk));
  }
  const importData = Buffer.concat(chunks).toString("utf-8");

  let importedCount = 0;

  const outline = await new Promise((resolve, reject) =>
    opml.parse(importData, (err: Error, data: object) =>
      err ? reject(err) : resolve(data)
    )
  );
  log.trace({ msg: "outline", outline });

  const writeQueue: BookmarkCreatable[] = [];

  opml.visitAll(outline, (node: any) => {
    if ("xmlUrl" in node || "htmlUrl" in node) {
      log.trace({ msg: "node", node });
      const { title, text, xmlUrl, htmlUrl } = node as Record<string, string>;
      const newBookmark: BookmarkCreatable = {
        ownerId,
        title: title || text,
        href: htmlUrl || xmlUrl,
        tags: ["imported:opml"],
        meta: {
          opml: node,
        },
      };
      writeQueue.push(newBookmark);
    }
    return true;
  });

  while (writeQueue.length > 0) {
    const batch = writeQueue.splice(0, batchSize);
    const result = await bookmarks.upsertBatch(batch);

    importedCount += result.length;
    log.debug({
      msg: "imported batch",
      importedCount,
    });
  }

  return importedCount;
}
