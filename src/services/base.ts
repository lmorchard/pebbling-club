import { BaseRepository } from "../repositories/base";
import { App } from "../app";

export class BaseService {
  repository: BaseRepository;

  constructor(repository: BaseRepository) {
    this.repository = repository;
  }
}


