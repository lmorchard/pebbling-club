import { BaseRepository } from "../repositories/base";
import { App } from "../app";

export class BaseService {
  repository: BaseRepository;

  constructor(repository: BaseRepository) {
    this.repository = repository;
  }
}

export type MinimalLogger = {
  debug: (data: Record<string, any>) => void;
  info: (data: Record<string, any>) => void;
  trace: (data: Record<string, any>) => void;
};
