import { AppModule } from "../../app/modules";
import { FetchService } from "../fetch";
import { IFeedsRepository } from "./types";

export * from "./types";

import { autodiscover } from "./autodiscover";
import { poll } from "./poll";
import { get } from "./get";
import { update, updateAll } from "./update";

export const configSchema = {
  feedPollMaxAge: {
    doc: "Default max age to consider a fetched feed fresh",
    format: Number,
    default: 1000 * 60 * 30,
  },
  feedPollMaxItems: {
    doc: "Maximum number of items to accept per feed poll",
    format: Number,
    default: 200,
  },
  feedPollTimeout: {
    doc: "Timeout in milliseconds for fetching a feed",
    format: Number,
    default: 20000,
  },
  feedUpdateAllConcurrency: {
    doc: "Number of concurrent feed updates",
    format: Number,
    default: 32,
  }
};

export type IAppRequirements = {
  feedsRepository: IFeedsRepository;
  fetch: FetchService;
};

export class FeedsService extends AppModule<IAppRequirements> {
  get: typeof get = get.bind(this);
  autodiscover: typeof autodiscover = autodiscover.bind(this);
  poll: typeof poll = poll.bind(this);
  update: typeof update = update.bind(this);
  updateAll: typeof updateAll = updateAll.bind(this);
}
