import Server from ".";

export interface IBaseRouterOptions {
  server: Server,
}

export enum FeedFormats {
  rss = "rss",
  atom = "atom",
  json = "json"
}
