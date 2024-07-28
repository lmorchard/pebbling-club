import { CliAppModule } from "../app/modules";

export class BaseRepositoryMethodUnimplementedError extends Error {}

export class BaseRepository extends CliAppModule {
  async createHashedPasswordAndSaltForUsername(
    username: string,
    hashed_password: string,
    salt: string
  ): Promise<string> {
    throw new BaseRepositoryMethodUnimplementedError();
  }

  async updateHashedPasswordAndSaltForUsername(
    username: string,
    hashed_password: string,
    salt: string
  ) {
    throw new BaseRepositoryMethodUnimplementedError();
  }  

  async getHashedPasswordAndSaltForUsername(
    username: string
  ): Promise<{ hashedPassword: string; salt: string }> {
    throw new BaseRepositoryMethodUnimplementedError();
  }

  async deleteHashedPasswordAndSaltForUsername(
    username: string,
  ): Promise<string> {
    throw new BaseRepositoryMethodUnimplementedError();
  }
}

export class MockRepository extends BaseRepository {
  // @ts-ignore not mocking an app here
  constructor() {
    // @ts-ignore not mocking an app here
    super();
  }
}
