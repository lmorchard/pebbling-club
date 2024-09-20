import assert from "assert";
import { BookmarkUpdatable } from "../bookmarks";
import { TestApp } from "../../utils/test";

export const commonImportTest = async (
  app: TestApp,
  profileId: string,
  expectedUrls: string[],
  importFn: () => Promise<number>
) => {
  const { bookmarks } = app;

  const importedCount1 = await importFn();
  assert.equal(importedCount1, 5, "expected total from import");

  for (const url of expectedUrls) {
    const result = await bookmarks.getByUrl(profileId, url);
    assert.ok(result !== null, `bookmark should exist for ${url}`);
    const { viewerId, canEdit, canView, ...bookmark } = result;

    const updated: BookmarkUpdatable = {
      ...bookmark,
      meta: { customData: true },
    };
    await bookmarks.update(bookmark.id, updated);
  }

  const importedCount2 = await importFn();
  assert.equal(importedCount2, 5, "expected total from import");

  for (const url of expectedUrls) {
    const result = await bookmarks.getByUrl(profileId, url);
    assert.ok(result !== null, `bookmark should exist for ${url}`);
    assert.ok(
      result.meta?.customData === true,
      `custom data should be true for ${url}`
    );
  }

  const { total, items } = await bookmarks.listForOwner(
    profileId,
    profileId,
    10,
    0
  );

  assert.equal(total, 5, "expected total from import");
  assert.equal(items.length, 5, "expected total from import");
};