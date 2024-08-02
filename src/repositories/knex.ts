import Knex from "knex";

export interface IKnexConnectionOptions {
  knexConnectionOptions(): Knex.Knex.Config["connection"];
}
