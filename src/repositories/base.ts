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
  ): Promise<undefined | { id: string; hashedPassword: string; salt: string }> {
    throw new BaseRepositoryMethodUnimplementedError();
  }

  async getUsernameForId(id: string): Promise<undefined | string> {
    throw new BaseRepositoryMethodUnimplementedError();
  }

  async deleteHashedPasswordAndSaltForUsername(
    username: string
  ): Promise<string> {
    throw new BaseRepositoryMethodUnimplementedError();
  }
}
