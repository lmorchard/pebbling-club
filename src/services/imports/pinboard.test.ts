import { describe, it, beforeEach, afterEach } from "node:test";
import { TestApp, buildReadableStreamFromString } from "../../utils/test";
import { commonImportTest } from "./test-utils";

describe("services/imports/pinboard", () => {
  const username = "johndoe";
  const password = "hunter23";

  let app: TestApp;
  let profileId: string;

  beforeEach(async () => {
    app = new TestApp("data/test/imports/pinboard");
    await app.init();
    profileId = await app.services.profiles.create({ username }, { password });
  });

  afterEach(async () => {
    await app.deinit();
  });

  it("importPinboard should import from JSON with idempotency", async () => {
    await commonImportTest(app, profileId, TEST_PINBOARD_URLS, () =>
      app.services.imports.importPinboardJSON(
        profileId,
        10,
        buildReadableStreamFromString(TEST_PINBOARD_JSON)
      )
    );
  });
});

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
