import { BaseRepository } from "../repositories/base";

export class BaseService {
  repository: BaseRepository;
  constructor(repository: BaseRepository) {
    this.repository = repository;
  }
}
