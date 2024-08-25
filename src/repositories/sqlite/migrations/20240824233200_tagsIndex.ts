import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.raw(`--sql
    CREATE TABLE 'tags' (
      'id' integer not null primary key autoincrement,
      'bookmarksId' varchar(255) not null,
      'ownerId' varchar(255) not null,
      'name' varchar(255) not null,
      FOREIGN KEY(bookmarksId)
        REFERENCES bookmarks(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      FOREIGN KEY(ownerId)
        REFERENCES profiles(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    );
  `).raw(`--sql
    CREATE UNIQUE INDEX tags_name_bookmarksId_ownerId ON tags(name, bookmarksId, ownerId);
  `).raw(`--sql
    CREATE INDEX tags_ownerId_name ON tags(ownerId, name);
  `).raw(`--sql
    CREATE TRIGGER tags_v1_insert AFTER INSERT ON bookmarks BEGIN
      INSERT INTO tags (bookmarksId, ownerId, name)
        SELECT new.id, new.ownerId, json_extract(tagItem.value, '$.name')
        FROM json_each(new.tags) as tagItem;
    END;
  `).raw(`--sql
    CREATE TRIGGER tags_v1_delete AFTER DELETE ON bookmarks BEGIN
      DELETE FROM tags WHERE bookmarksId = old.id;
    END;    
  `).raw(`--sql
    CREATE TRIGGER tags_v1_update AFTER UPDATE ON bookmarks BEGIN
      DELETE FROM tags WHERE bookmarksId = old.id;
      INSERT INTO tags (bookmarksId, ownerId, name)
        SELECT new.id, new.ownerId, json_extract(tagItem.value, '$.name')
        FROM json_each(new.tags) as tagItem;
    END;    
  `);
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema
    .raw("DROP TRIGGER tags_v1_insert")
    .raw("DROP TRIGGER tags_v1_delete")
    .raw("DROP TRIGGER tags_v1_update")
    .raw(`DROP INDEX tags_name_bookmarkId_ownerId`)
    .raw(`DROP INDEX tags_ownerId_name`)
    .dropTable("tags");
}
