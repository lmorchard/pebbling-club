import { v4 as uuid } from "uuid";
import { IKnexConnectionOptions, IKnexRepository } from "../../knex";
import BaseSqliteKnexRepository from "../base";
import Knex from "knex";
import { BaseJobScheduleModel, IJobsRepository } from "../../../services/jobs";
import {
  JobModel,
  JobModelNew,
  JobOptions,
  JobPayload,
  JobResult,
  JobState,
  JobStatus,
  JobScheduleModel,
} from "@/services/jobs/types";

export const configSchema = {
  sqliteJobsDatabaseName: {
    doc: "Filename for sqlite3 jobs database",
    env: "SQLITE_JOBS_FILENAME",
    format: String,
    default: "jobs.sqlite3",
  },
} as const;

export default class SqliteJobsRepository
  extends BaseSqliteKnexRepository
  implements IJobsRepository, IKnexRepository, IKnexConnectionOptions
{
  get migrationsDirectory() {
    return this._resolveMigrationsDirectory("jobs");
  }

  knexConnectionOptions(): Knex.Knex.Config["connection"] {
    return this._buildKnexConnectionOptions("sqliteJobsDatabaseName");
  }

  async addJob(jobs: JobModelNew[]): Promise<string[]> {
    const results: string[] = [];
    await this.enqueue(() =>
      this.connection.transaction(async (trx) => {
        for (const job of jobs) {
          const { name, payload, options } = job;

          // Tried finding a way to leave deduplicationId as null, but it
          // seems simplest to generate a unique one if not provided.
          const deduplicationId = options?.deduplication?.id || uuid();

          let deferUntil = options?.deferUntil;
          if (options?.delay) {
            const delay = options.delay;
            if (deferUntil) {
              deferUntil += delay;
            } else {
              deferUntil = Date.now() + delay;
            }
          }

          const toInsert: Record<string, any> = {
            name,
            options: JSON.stringify(options),
            payload: JSON.stringify(payload),
            state: JobState.Pending,
            deduplicationId,
            deferUntil,
          };
          const result = await trx("Jobs")
            .insert(toInsert)
            .onConflict("deduplicationId")
            // HACK: this should essentially be a no-op which still returns the ID
            .merge({ deduplicationId })
            .returning("id");
          results.push(result[0].id);
        }
      })
    );
    return results;
  }

  async listJobs(
    options: {
      name?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<JobModel[]> {
    const { name, limit, offset } = options;
    const query = this.connection("Jobs");
    if (name) query.where({ name });
    if (limit) query.limit(limit);
    if (offset) query.offset(offset);
    const results = await query;
    return results.map((row) => SqliteJobModel.fromRow(row));
  }

  async fetchJobById(id: string): Promise<JobModel | undefined> {
    const row = await this.connection("Jobs").where({ id }).first();
    return row && SqliteJobModel.fromRow(row);
  }

  async reserveJob(jobNames?: string[]): Promise<JobModel | undefined> {
    const reservation = uuid();
    const now = Date.now();

    // Reserve the highest priority, newest, unreserved, pending job
    // using a queued write to help ensure serialization. Use the returning
    // clause to get the job details.
    const result = await this.enqueue(async () =>
      this.connection("Jobs")
        .where("rowid", (q: Knex.Knex.QueryBuilder) =>
          q
            .select("rowid")
            .from("Jobs")
            .whereNull("reservation")
            .andWhere("state", JobState.Pending)
            .andWhere((q) =>
              q.whereNull("deferUntil").orWhere("deferUntil", "<=", now)
            )
            .modify((q) => {
              if (jobNames) q.whereIn("name", jobNames);
            })
            .orderBy([
              { column: "priority", order: "desc" },
              { column: "createdAt", order: "desc" },
            ])
            .limit(1)
        )
        .update({
          reservation,
          deduplicationId: reservation,
          state: JobState.Reserved,
        })
        .returning("*")
    );

    return result && result[0] && SqliteJobModel.fromRow(result[0]);
  }

  async updateJob<Result extends JobResult>({
    id,
    state,
    status,
    result,
  }: {
    id: string;
    state?: JobState;
    status?: JobStatus;
    result?: Result;
  }): Promise<void> {
    await this.enqueue(async () => {
      const { connection: conn } = this;
      const toUpdate: Record<string, any> = {};
      if (state) toUpdate["state"] = state;
      if (status) {
        toUpdate["status"] = conn.raw(
          "json_patch(iif(json_valid(status), status, '{}'), :status)",
          { status: JSON.stringify(status) }
        );
      }
      if (result) toUpdate["result"] = JSON.stringify(result);

      return await conn("Jobs").update(toUpdate).where({ id });
    });
  }

  async retryJob(job: JobModel) {
    const { id, options = {} } = job;

    const attempts = options.attempts || 0;
    if (attempts < 1) return;

    // TODO: record failures for each attempt?

    await this.enqueue(() =>
      this.connection("Jobs")
        .update({
          state: JobState.Pending,
          reservation: null,
          options: JSON.stringify({
            ...options,
            attempts: attempts - 1,
          }),
        })
        .where({ id })
    );
  }

  async purgeResolvedJobs(): Promise<void> {
    await this.enqueue(() =>
      this.connection("Jobs")
        .where("state", JobState.Completed)
        .orWhere("state", JobState.Failed)
        .delete()
    );
  }

  async upsertJobSchedule(
    schedule: JobScheduleModel
  ): Promise<JobScheduleModel> {
    const model = SqliteJobScheduleModel.fromModel(schedule);
    const toInsert = model.toRow();
    await this.enqueue(() =>
      this.connection("JobSchedules")
        .insert(toInsert)
        .onConflict(["key"])
        .merge()
    );
    return model;
  }

  async fetchJobSchedule(key: string): Promise<JobScheduleModel | undefined> {
    const row = await this.connection("JobSchedules").where({ key }).first();
    return row && SqliteJobScheduleModel.fromRow(row);
  }

  async listReadyJobSchedules(limit: number): Promise<JobScheduleModel[]> {
    const results = await this.connection("JobSchedules")
      .leftJoin("Jobs", "JobSchedules.jobId", "Jobs.id")
      .whereNull("Jobs.id")
      .orWhereNot("Jobs.state", JobState.Pending)
      .limit(limit);
    return results.map((row) => SqliteJobScheduleModel.fromRow(row));
  }
}

export class SqliteJobModel implements JobModel {
  id!: string;
  name!: string;
  payload!: JobPayload;
  result?: JobResult | undefined;
  options?: JobOptions | undefined;
  status?: JobStatus | undefined;
  state!: JobState;

  constructor(init?: JobModel) {
    Object.assign(this, init);
  }

  toRow(): Record<string, string | number | undefined> {
    const { id, name, payload, result, options = {}, status, state } = this;
    const { priority } = options;
    return {
      id,
      priority,
      name,
      state,
      payload: JSON.stringify(payload),
      options: JSON.stringify(options),
      result: JSON.stringify(result),
      status: JSON.stringify(status),
    };
  }

  static fromModel(model: JobModel): SqliteJobModel {
    return new SqliteJobModel(model);
  }

  static fromRow(
    row: Record<string, string | number | undefined>
  ): SqliteJobModel {
    const { id, name, payload, result, options, status, state } = row;
    if (!id || !name || !payload || !state) {
      throw new Error("incomplete job from row");
    }
    return new SqliteJobModel({
      id: id as string,
      name: name as string,
      state: state as JobState,
      payload: payload && JSON.parse(payload as string),
      result: result && JSON.parse(result as string),
      options: options && JSON.parse(options as string),
      status: status && JSON.parse(status as string),
    });
  }
}

export class SqliteJobScheduleModel extends BaseJobScheduleModel {
  toRow(): Record<string, string | number | undefined> {
    const { key, repeatOptions, jobTemplate, jobId, prevMillis, nextMillis } =
      this;
    return {
      key,
      repeatOptions: JSON.stringify(repeatOptions),
      jobTemplate: JSON.stringify(jobTemplate),
      jobId,
      prevMillis,
      nextMillis,
    };
  }

  static fromModel(model: JobScheduleModel): SqliteJobScheduleModel {
    return new SqliteJobScheduleModel(model);
  }

  static fromRow(
    row: Record<string, string | number | undefined>
  ): SqliteJobScheduleModel {
    const { key, repeatOptions, jobTemplate, jobId, prevMillis, nextMillis } =
      row;
    if (
      typeof key !== "string" ||
      typeof repeatOptions !== "string" ||
      typeof jobTemplate !== "string"
    ) {
      throw new Error("incomplete row");
    }
    return new SqliteJobScheduleModel({
      key,
      repeatOptions: JSON.parse(repeatOptions),
      jobTemplate: JSON.parse(jobTemplate),
      jobId: typeof jobId === "string" ? jobId : undefined,
      prevMillis: typeof prevMillis === "number" ? prevMillis : undefined,
      nextMillis: typeof nextMillis === "number" ? nextMillis : undefined,
    });
  }
}
