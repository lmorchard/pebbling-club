import { BaseService } from "../base";
import { BookmarksService } from "../bookmarks";
import { IApp } from "../../app/types";
import { importPinboardJSON } from "./pinboard";
import { importRaindropCSV } from "./raindrop";
import { importOPML } from "./opml";

export type IAppRequirements = {
  bookmarks: BookmarksService;
};

export class ImportService extends BaseService<IAppRequirements> {
  importPinboardJSON: typeof importPinboardJSON;
  importRaindropCSV: typeof importRaindropCSV;
  importOPML: typeof importOPML;

  constructor(app: IApp & IAppRequirements) {
    super(app);

    this.importPinboardJSON = importPinboardJSON.bind(this);
    this.importRaindropCSV = importRaindropCSV.bind(this);
    this.importOPML = importOPML.bind(this);
  }
}
