import { describe, it, beforeEach, afterEach } from "node:test";
import { TestApp, buildReadableStreamFromString } from "../../utils/test";
import { commonImportTest } from "./test-utils";

describe("services/imports", () => {
  const username = "johndoe";
  const password = "hunter23";

  let app: TestApp;
  let profileId: string;

  beforeEach(async () => {
    app = new TestApp("data/test/imports/raindrop");
    await app.init();
    profileId = await app.services.profiles.create({ username }, { password });
  });

  afterEach(async () => {
    await app.deinit();
  });

  it("importRaindropCsv should import from CSV with idempotency", async () => {
    await commonImportTest(app, profileId, TEST_RAINDROP_URLS, () =>
      app.services.imports.importRaindropCSV(
        profileId,
        10,
        buildReadableStreamFromString(TEST_RAINDROP_CSV)
      )
    );
  });
});

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
