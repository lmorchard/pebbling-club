import { BaseRepository } from "../repositories/base";

export class MockRepository extends BaseRepository {
  // @ts-ignore not mocking an app here
  constructor() {
    // @ts-ignore not mocking an app here
    super();
  }
}
