import Knex from "knex";
import { BaseRepository } from "./base";

export interface BaseKnexRepository extends BaseRepository {
  knexConnectionOptions(): Knex.Knex.Config["connection"];
}
