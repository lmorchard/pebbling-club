import { AppModule } from "../../app/modules";
import { FetchService } from "../fetch";
import { JobsService } from "../jobs";
import { IFeedsRepository } from "./types";
import { autodiscover } from "./autodiscover";
import { poll } from "./poll";
import { get } from "./get";
import { update, updateAll, updateAllWithJobQueue } from "./update";
import {
  initJobs,
  handleUpdateFeedJob,
  deferFeedUpdate,
  handleUpdateAllFeedsJob,
  scheduleAllFeedsUpdate,
} from "./jobs";

export * from "./types";

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
  },
};

export type IAppRequirements = {
  feedsRepository: IFeedsRepository;
  fetch: FetchService;
  jobs?: JobsService;
};

export class FeedsService extends AppModule<IAppRequirements> {
  get: typeof get = get.bind(this);
  autodiscover: typeof autodiscover = autodiscover.bind(this);
  poll: typeof poll = poll.bind(this);
  update: typeof update = update.bind(this);
  updateAll: typeof updateAll = updateAll.bind(this);
  updateAllWithJobQueue: typeof updateAllWithJobQueue =
    updateAllWithJobQueue.bind(this);
  initJobs: typeof initJobs = initJobs.bind(this);
  handleUpdateFeedJob: typeof handleUpdateFeedJob =
    handleUpdateFeedJob.bind(this);
  handleUpdateAllFeedsJob: typeof handleUpdateAllFeedsJob =
    handleUpdateAllFeedsJob.bind(this);
  deferFeedUpdate: typeof deferFeedUpdate = deferFeedUpdate.bind(this);
  scheduleAllFeedsUpdate: typeof scheduleAllFeedsUpdate =
    scheduleAllFeedsUpdate.bind(this);

  async init() {
    await this.initJobs();
    return super.init();
  }
}
