import assert from "node:assert";
import { Readable } from "stream";
import { describe, it, beforeEach, afterEach } from "node:test";
import { BaseApp } from "../../app";
import { IApp } from "../../app/types";
import { AppModule } from "../../app/modules";
import {
  BookmarksService,
  BookmarkUpdatable,
  IBookmarksRepository,
} from "../bookmarks";
import { SqliteRepository } from "../../repositories/sqlite";
import { ImportService } from ".";
import { rimraf } from "rimraf";
import { IProfilesRepository, ProfileService } from "../profiles";
import { IPasswordsRepository, PasswordService } from "../passwords";

describe("services/imports", () => {
  const username = "johndoe";
  const password = "hunter23";

  let app: TestApp;
  let profileId: string;

  beforeEach(async () => {
    app = new TestApp();
    await app.init();

    profileId = await app.services.profiles.create({ username }, { password });
  });

  afterEach(async () => {
    await app.deinit();
  });

  it("importPinboard should import from JSON with idempotency", async () => {
    await commonImportTest(TEST_PINBOARD_URLS, () =>
      app.services.imports.importPinboardJSON(
        profileId,
        10,
        buildImportStream(TEST_PINBOARD_JSON)
      )
    );
  });

  it("importRaindropCsv should import from CSV with idempotency", async () => {
    await commonImportTest(TEST_RAINDROP_URLS, () =>
      app.services.imports.importRaindropCSV(
        profileId,
        10,
        buildImportStream(TEST_RAINDROP_CSV)
      )
    );
  });

  const commonImportTest = async (
    expectedUrls: string[],
    importFn: () => Promise<number>
  ) => {
    const { imports, bookmarks } = app.services;

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
});

export class TestServices extends AppModule {
  passwords: PasswordService;
  profiles: ProfileService;
  bookmarks: BookmarksService;
  imports: ImportService;

  constructor(app: TestApp) {
    super(app);

    const { repository } = app;

    this.passwords = new PasswordService(app, repository);
    this.profiles = new ProfileService(app, repository, this.passwords);
    this.bookmarks = new BookmarksService(app, repository);
    this.imports = new ImportService(app, this.bookmarks);
  }
}

class TestApp extends BaseApp implements IApp {
  repository: IPasswordsRepository & IProfilesRepository & IBookmarksRepository;
  services: TestServices;

  constructor(testDatabasePath = "data/test/imports") {
    super();

    this.modules.push(
      (this.repository = new SqliteRepository(this)),
      (this.services = new TestServices(this))
    );

    this.config.set("logLevel", "fatal");
    this.config.set("sqliteDatabasePath", testDatabasePath);
  }

  async init() {
    await rimraf(this.config.get("sqliteDatabasePath"));
    return super.init();
  }

  async deinit() {
    await super.deinit();
    await rimraf(this.config.get("sqliteDatabasePath"));
    return this;
  }
}

const buildImportStream = (src: string) => {
  const importFileStream = new Readable();
  importFileStream.push(src);
  importFileStream.push(null);
  return importFileStream;
};

const TEST_PINBOARD_JSON = `
[
{"href":"https:\/\/hackaday.com\/2023\/08\/29\/retro-gadgets-the-1974-breadboard-project\/","description":"Retro Gadgets: The 1974 Breadboard Project | Hackaday","extended":"It is hard to imagine experimenting with electronics without the ubiquitous solderless breadboard. We are sure you have a few within arm\u2019s reach. The little plastic wonders make it easy to throw together a circuit, try it, and then tear it down again. But, surprisingly, breadboards of that type haven\u2019t always been around, and \u2014 for a while \u2014 they were also an expensive item. Maybe that\u2019s what motivated [R. G. Cooper] to build Slip-n-Clip \u2014 his system for quickly building circuits that he published in a 1974 edition of the magazine Elementary Electronics.","meta":"729651e2996a05ac3e8332c28cee7b65","hash":"c4641c4a0d778a39d44c6a43b962324d","time":"2023-08-29T22:30:46Z","shared":"yes","toread":"no","tags":"electronics projects history"},
{"href":"https:\/\/github.com\/MSzturc\/obsidian-advanced-slides","description":"GitHub - MSzturc\/obsidian-advanced-slides: Create markdown-based reveal.js presentations in Obsidian","extended":"lmorchard starred MSzturc\/obsidian-advanced-slides","meta":"5ea73ae4409a009f246ad9bdba22353c","hash":"46de9d655ee30c9a879cd161ff3b6f6e","time":"2023-08-10T01:00:32Z","shared":"yes","toread":"no","tags":"github needs-tags"},
{"href":"https:\/\/www.agwa.name\/blog\/post\/ssh_signatures","description":"It's Now Possible To Sign Arbitrary Data With Your SSH Keys","extended":"Did you know that you can use the ssh-keygen command to sign and verify signatures on arbitrary data, like files and software releases?","meta":"f9e7e26ba81554880f4266be9cd4d79c","hash":"874888bbb65a136bd897319f7f21e707","time":"2023-08-09T22:58:35Z","shared":"yes","toread":"no","tags":"ssh crypto gpg github cryptography security git"},
{"href":"https:\/\/thenewstack.io\/how-to-sign-git-commits-with-an-ssh-key\/","description":"How to Sign git Commits with an SSH key - The New Stack","extended":"By using signing in SSH commits, you can more easily verify that each commit was submitted by a legitimate developer and not an impostor.","meta":"b156b33a82ddf642bd74c6cd20889583","hash":"1e556fedb7fc29b85fa09c9cc2dd4451","time":"2023-08-09T22:20:09Z","shared":"yes","toread":"no","tags":"ssh git crypto"},
{"href":"https:\/\/github.com\/aardappel\/treesheets","description":"GitHub - aardappel\/treesheets: TreeSheets : Free Form Data Organizer (see strlen.com\/treesheets)","extended":"lmorchard starred aardappel\/treesheets","meta":"36c67466b803fb4198865c21174dc88b","hash":"44a1319b87d6d1cd8fba26fdddd4b818","time":"2023-08-08T04:01:20Z","shared":"yes","toread":"no","tags":"github needs-tags"}
]
`.trim();

const TEST_PINBOARD_URLS = [
  "https://hackaday.com/2023/08/29/retro-gadgets-the-1974-breadboard-project/",
  "https://github.com/MSzturc/obsidian-advanced-slides",
  "https://www.agwa.name/blog/post/ssh_signatures",
  "https://thenewstack.io/how-to-sign-git-commits-with-an-ssh-key/",
  "https://github.com/aardappel/treesheets",
];

const TEST_RAINDROP_CSV = `
id,title,note,excerpt,url,folder,tags,created,cover,highlights,favorite
847056864,"bee-queue/bee-queue: A simple, fast, robust job/task queue for Node.js, backed by Redis.",,"A simple, fast, robust job/task queue for Node.js, backed by Redis. - bee-queue/bee-queue",https://github.com/bee-queue/bee-queue,Unsorted,,2024-09-03T20:06:53.347Z,https://opengraph.githubassets.com/f608f8f3b8e9fe482cf2b6274aac3528a297aa246650b4c26c350d735583bc13/bee-queue/bee-queue,"Highlight:A simple, fast, robust job/task queue for Node.js, backed by Redis.",false
845649598,Impossible Vortex Passthrough illusion - Version 2 by RJ Design,,"The Design&nbsp;Building on the well received  impossible passthrough illusion. This is Version 2&nbsp;It fixes the problems present in the first Design. &nbsp;No more messy overhang, a good slide straight after printing, and much better bed adhesion. &nbsp;This is a fun piece and can be used as a fidget toy as well&nbsp;Dimensions are approximately: diameter 46mm x 50mm&nbsp;Let me know if you experience any issues.&nbsp;If you enjoy this print consider giving it a boost (It'd really help me out!)&nbsp;Printing&nbsp;The Print Profile should be used if possible. The hour glass object should have auto tree supports enabled to 30 degrees, and a layer height of 0.16mm, the barrel shape should have no supports and a layer height of 0.2mm &nbsp;It is set up to print by object (1 part then the next) &nbsp;&nbsp;My WorkAfter many years in Engineering, I've just decided to try and follow my childhood dream of becoming of a Creative Designer.A Creative Designer of what? No idea! Right now I really like puzzles, mechanisms and kinetic sculptures so that's where I'm going to focus my efforts.&nbsp;Boosts really help me out&nbsp;To support me even more (not ever required), for information around development of my models (background to come) and for commercial use, i've started a patreon here:https://www.patreon.com/RJ_Design",https://makerworld.com/en/models/497301#profileld-411727,Unsorted,,2024-09-02T01:15:43.081Z,https://makerworld.bblmw.com/makerworld/model/USf3a9d995b37400/design/2024-06-15_c9ad942b6202.gif,,false
842806663,NEW DESIGN: Little Dark and her cat | Happy Flexi Pets,,Get more from Happy Flexi Pets  on Patreon,https://www.patreon.com/posts/new-design-dark-109805244,Unsorted,,2024-08-28T18:29:28.798Z,https://www.patreon.com/meta-image/post/109805244,,false
841287017,public,,lmorchard's public boomarks,https://raindrop.io/lmorchard/public-47164517,Unsorted,bookmarks,2024-08-25T05:57:41.428Z,https://pub.raindrop.io/api/ogimage?url=https%3A%2F%2Fraindrop.io%2Flmorchard%2Fpublic-47164517&v=1724565035581,Highlight:lmorchard's public boomarks,false
836247078,BART Model for Text Summarization,,"This tutorial covers the origins and uses of the BART model for text summarization tasks, and concludes with a brief demo for using BART with Paperspace Notebooks.",https://blog.paperspace.com/bart-model-for-text-summarization-part1/,Unsorted,"ai, text, bart, ml",2024-08-16T09:51:12.091Z,https://blog.paperspace.com/content/images/2023/09/asfa.png,,false
`.trim();

const TEST_RAINDROP_URLS = [
  "https://github.com/bee-queue/bee-queue",
  "https://makerworld.com/en/models/497301#profileld-411727",
  "https://www.patreon.com/posts/new-design-dark-109805244",
  "https://raindrop.io/lmorchard/public-47164517",
  "https://blog.paperspace.com/bart-model-for-text-summarization-part1/",  
];
