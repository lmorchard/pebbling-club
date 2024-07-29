import Knex from "knex";
import { BaseRepository, BaseRepositoryMethodUnimplementedError } from "./base";

export class BaseKnexRepository extends BaseRepository {
  knexConnectionOptions(): Knex.Knex.Config["connection"] {
    throw new BaseRepositoryMethodUnimplementedError();
  }
}
