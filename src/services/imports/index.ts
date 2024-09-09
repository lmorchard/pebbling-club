import { BaseService } from "../base";
import { BookmarksService } from "../bookmarks";
import { IApp } from "../../app/types";
import { importPinboardJSON } from "./pinboard";
import { importRaindropCSV } from "./raindrop";

export class ImportService extends BaseService {
  bookmarks: BookmarksService;

  importPinboardJSON: typeof importPinboardJSON;
  importRaindropCSV: typeof importRaindropCSV;

  constructor(app: IApp, bookmarks: BookmarksService) {
    super(app);
    this.bookmarks = bookmarks;

    this.importPinboardJSON = importPinboardJSON.bind(this);
    this.importRaindropCSV = importRaindropCSV.bind(this);
  }
}
