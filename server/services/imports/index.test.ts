import assert from "assert";
import { describe, it, beforeEach, afterEach } from "node:test";
import { TestApp, buildReadableStreamFromString } from "../../utils/test";
import { commonImportTest } from "./test-utils";

describe("services/imports", () => {
  const username = "johndoe";
  const password = "hunter23";

  let app: TestApp;
  let profileId: string;

  beforeEach(async () => {
    app = new TestApp("data/test/imports/index");
    await app.init();
    profileId = await app.profiles.create({ username }, { password });
  });

  afterEach(async () => {
    await app.deinit();
  });

  it("importPinboardJSON and importRaindropCSV should not produce duplicates", async () => {
    const { bookmarks } = app;

    const importedCount1 = await app.imports.importRaindropCSV(
      profileId,
      10,
      buildReadableStreamFromString(TEST_RAINDROP_CSV)
    );
    console.log(importedCount1);
    assert.equal(importedCount1, TEST_RAINDROP_URLS.length);

    const importedCount2 = await app.imports.importPinboardJSON(
      profileId,
      10,
      buildReadableStreamFromString(TEST_PINBOARD_JSON)
    );
    assert.equal(importedCount2, TEST_PINBOARD_URLS.length);

    const { total, items } = await bookmarks.listForOwner(
      profileId,
      profileId,
      { limit: 10, offset: 0 }
    );

    assert.equal(
      total,
      TEST_COMBINED_URLS.length,
      "expected total from import"
    );
    assert.equal(
      items.length,
      TEST_COMBINED_URLS.length,
      "expected total from import"
    );
  });
});

const TEST_PINBOARD_JSON = `
[
{"href":"http:\/\/abcnews.go.com\/US\/wireStory?id=201062&CMP=OTC-RSSFeeds0312","description":"ABC News: NASA: Bush Stifles Global Warming Evidence","extended":"Bet the Bush team wishes that pesky Galileo guy had never been born.  Would be nice to have a flat earth still at the center of the universe.","meta":"73e8f2d61bd010b36c6eadac529ce233","hash":"0dc50b4debd924af8cb2c44825e68d56","time":"2004-10-27T11:13:34Z","shared":"yes","toread":"no","tags":"science"},
{"href":"http:\/\/an9.org\/devdev\/why_frameworks_suck?sxip-homesite=&checked=1","description":"Why Frameworks Suck | devdev2040","extended":"\\"...frameworks suck because they take the fun out of programming, long live the library.\\"  This is why I like WSGI.  It's not a framework.","meta":"014f8f9ce0d24fae6ab5d42bcd9ef0be","hash":"7f0c271f8fb15e73bc05d095a98d402d","time":"2005-07-19T02:57:49Z","shared":"yes","toread":"no","tags":"python webdev"},
{"href":"http:\/\/alternet.org\/economy\/real-story-detroits-economy-good-things-are-really-happening-motown?page=0%2C0","description":"The Real Story Behind the Decline of Detroit \u2026 And Yes, Great Things Are Ha","extended":"","meta":"b5c2a9a363b835232791cfdb20a4065e","hash":"6a328a83559b01af74ae429f53e5886d","time":"2013-09-12T01:36:12Z","shared":"yes","toread":"yes","tags":"Unread"},
{"href":"https:\/\/hackaday.com\/2023\/08\/29\/retro-gadgets-the-1974-breadboard-project\/","description":"Retro Gadgets: The 1974 Breadboard Project | Hackaday","extended":"It is hard to imagine experimenting with electronics without the ubiquitous solderless breadboard. We are sure you have a few within arm\u2019s reach. The little plastic wonders make it easy to throw together a circuit, try it, and then tear it down again. But, surprisingly, breadboards of that type haven\u2019t always been around, and \u2014 for a while \u2014 they were also an expensive item. Maybe that\u2019s what motivated [R. G. Cooper] to build Slip-n-Clip \u2014 his system for quickly building circuits that he published in a 1974 edition of the magazine Elementary Electronics.","meta":"729651e2996a05ac3e8332c28cee7b65","hash":"c4641c4a0d778a39d44c6a43b962324d","time":"2023-08-29T22:30:46Z","shared":"yes","toread":"no","tags":"electronics projects history"},
{"href":"http:\/\/annearchy.com\/blog\/?p=3661","description":"Treasury Tuesday: Beer Nerds Gift Guide","extended":"","meta":"faf98683a3ded4fc7a2864dda3beca3e","hash":"c1967edb16b204ad1c8ea55995f2985a","time":"2010-12-14T14:00:00Z","shared":"yes","toread":"no","tags":""},
{"href":"http:\/\/mashable.com\/2013\/08\/11\/teens-facebook\/?utm_cid=mash-prod-email-topstories","description":"I'm 13 and None of My Friends Use Facebook","extended":"I decided to get a Facebook just to see what it was all about. I soon discovered that Facebook is useless without friends. My only friend is, like, my grandma. ","meta":"0d6bf5e5df06eb7807f429e3b0b94a70","hash":"cdc93f083982e69d53e3de5e96ec206c","time":"2013-08-12T16:59:36Z","shared":"yes","toread":"no","tags":"social funny facebook youth to:fb"},
{"href":"http:\/\/bash.org\/?564283","description":"QDB: Quote #564283","extended":"\\"Hi, I'd like to speak with, um, Mr Testy McTest...\\"","meta":"68bb308557d1a4a25ada98d80d6296db","hash":"94e043302ac264225f62f66133d905ba","time":"2005-10-26T15:56:28Z","shared":"yes","toread":"no","tags":"funny irc quotes"}
]
`.trim();

const TEST_PINBOARD_URLS = [
  "http://abcnews.go.com/US/wireStory?id=201062&CMP=OTC-RSSFeeds0312",
  "http://an9.org/devdev/why_frameworks_suck?sxip-homesite=&checked=1",
  "http://alternet.org/economy/real-story-detroits-economy-good-things-are-really-happening-motown?page=0%2C0",
  "https://hackaday.com/2023/08/29/retro-gadgets-the-1974-breadboard-project/",
  "http://annearchy.com/blog/?p=3661",
  "http://mashable.com/2013/08/11/teens-facebook/?utm_cid=mash-prod-email-topstories",
  "http://bash.org/?564283",
];

const TEST_RAINDROP_CSV = `
id,title,note,excerpt,url,folder,tags,created,cover,highlights,favorite
833362132,ABC News: NASA: Bush Stifles Global Warming Evidence,Bet the Bush team wishes that pesky Galileo guy had never been born.  Would be nice to have a flat earth still at the center of the universe.,,http://abcnews.go.com/US/wireStory?CMP=OTC-RSSFeeds0312&id=201062,pinboard_export_2024_07_31_03_19,science,2004-10-27T11:13:34.000Z,,,false
833360617,Why Frameworks Suck | devdev2040,"""...frameworks suck because they take the fun out of programming, long live the library.""  This is why I like WSGI.  It's not a framework.",,http://an9.org/devdev/why_frameworks_suck?checked=1&sxip-homesite=,pinboard_export_2024_07_31_03_19,"python, webdev",2005-07-19T02:57:49.000Z,,,false
833340459,"The Real Story Behind the Decline of Detroit … And Yes, Great Things Are Ha",,,"http://alternet.org/economy/real-story-detroits-economy-good-things-are-really-happening-motown?page=0,0",pinboard_export_2024_07_31_03_19,Unread,2013-09-12T01:36:12.000Z,,,false
833335087,Retro Gadgets: The 1974 Breadboard Project | Hackaday,"It is hard to imagine experimenting with electronics without the ubiquitous solderless breadboard. We are sure you have a few within arm’s reach. The little plastic wonders make it easy to throw together a circuit, try it, and then tear it down again. But, surprisingly, breadboards of that type haven’t always been around, and — for a while — they were also an expensive item. Maybe that’s what motivated [R. G. Cooper] to build Slip-n-Clip — his system for quickly building circuits that he published in a 1974 edition of the magazine Elementary Electronics.",It is hard to imagine experimenting with electronics without the ubiquitous solderless breadboard. We are sure you have a few within arm’s reach. The little plastic wonders make it easy to th…,https://hackaday.com/2023/08/29/retro-gadgets-the-1974-breadboard-project,public,"electronics, projects, history",2023-08-29T22:30:46.000Z,https://hackaday.com/wp-content/uploads/2023/08/retro.png,,false
833349846,Treasury Tuesday: Beer Nerds Gift Guide,,,http://annearchy.com/blog?p=3661,pinboard_export_2024_07_31_03_19,,2010-12-14T14:00:00.000Z,,,false
833340570,I'm 13 and None of My Friends Use Facebook,"I decided to get a Facebook just to see what it was all about. I soon discovered that Facebook is useless without friends. My only friend is, like, my grandma.",,http://mashable.com/2013/08/11/teens-facebook,pinboard_export_2024_07_31_03_19,"social, funny, facebook, youth, to:fb",2013-08-12T16:59:36.000Z,https://helios-i.mashable.com/imagery/archives/02g2UXoSyD72XtZpQZiONXU/hero-image.fill.size_1200x675.v1647029580.jpg,,false
833359921,QDB: Quote #564283,"""Hi, I'd like to speak with, um, Mr Testy McTest...""",,http://bash.org/?564283=,pinboard_export_2024_07_31_03_19,"funny, irc, quotes",2005-10-26T15:56:28.000Z,,,false
`.trim();

const TEST_RAINDROP_URLS = [
  "http://abcnews.go.com/US/wireStory?CMP=OTC-RSSFeeds0312&id=201062",
  "http://an9.org/devdev/why_frameworks_suck?checked=1&sxip-homesite=",
  "http://alternet.org/economy/real-story-detroits-economy-good-things-are-really-happening-motown?page=0,0",
  "https://hackaday.com/2023/08/29/retro-gadgets-the-1974-breadboard-project",
  "http://annearchy.com/blog?p=3661",
  "http://mashable.com/2013/08/11/teens-facebook",
  "http://bash.org/?564283=",
];

const TEST_COMBINED_URLS = [
  "http://abcnews.go.com/US/wireStory?id=201062&CMP=OTC-RSSFeeds0312",
  "http://an9.org/devdev/why_frameworks_suck?sxip-homesite=&checked=1",
  "http://alternet.org/economy/real-story-detroits-economy-good-things-are-really-happening-motown?page=0%2C0",
  "https://hackaday.com/2023/08/29/retro-gadgets-the-1974-breadboard-project/",
  "http://annearchy.com/blog/?p=3661",
  "http://mashable.com/2013/08/11/teens-facebook/?utm_cid=mash-prod-email-topstories",
  "http://bash.org/?564283",
];
