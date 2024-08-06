import { CliAppModule } from "../app/modules";
import { App } from "../app";

import CliProfiles from "./profiles";
import CliImport from "./import";
import CliBookmarks from "./bookmarks";

export default class CliIndex extends CliAppModule {
  async init() {
    const app = this.app as App;

    app.registerModule("profiles", CliProfiles);
    app.registerModule("import", CliImport);
    app.registerModule("bookmarks", CliBookmarks);

    return this;
  }
}
