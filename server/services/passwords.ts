import crypto from "crypto";
import { BaseService } from "./base";
import { IApp } from "../app/types";
import { Profile } from "./profiles";

export type IAppRequirements = {
  repository: IPasswordsRepository;
};

export class PasswordService extends BaseService<IAppRequirements> {
  hashIterations: number;
  hashLength: number;
  hashAlgo: string;

  constructor({ app }: { app: IApp & IAppRequirements}) {
    super({ app });

    // TODO: make these configurable
    this.hashIterations = 310000;
    this.hashLength = 32;
    this.hashAlgo = "sha256";
  }

  async list() {
    return await this.app.repository.listAllUsers();
  }

  async create(
    profile: { id: string; username: string },
    password: string,
    originalSalt?: string
  ) {
    const { passwordHashed, salt } = await this.hashPassword(
      password,
      originalSalt
    );
    const userId =
      await this.app.repository.createHashedPasswordAndSaltForUsernameAndProfileId(
        profile.username,
        profile.id,
        passwordHashed,
        salt
      );
    return userId;
  }

  async update(username: string, password: string) {
    const { passwordHashed, salt } = await this.hashPassword(password);
    return await this.app.repository.updateHashedPasswordAndSaltForUsername(
      username,
      passwordHashed,
      salt
    );
  }

  async verify(username: string, password: string) {
    const result = await this.app.repository.getHashedPasswordAndSaltForUsername(
      username
    );
    if (!result) return;

    const { id, passwordHashed, salt, profileId } = result;

    const { passwordHashed: submittedHashedPassword } = await this.hashPassword(
      password,
      salt
    );

    const verified = crypto.timingSafeEqual(
      this.hexToArray(submittedHashedPassword),
      this.hexToArray(passwordHashed)
    );

    return verified ? { id, profileId } : undefined;
  }

  async getUsernameById(id: string) {
    return await this.app.repository.getUsernameById(id);
  }

  async getIdByUsername(username: string) {
    return await this.app.repository.getIdByUsername(username);
  }

  async usernameExists(username: string) {
    return await this.app.repository.checkIfPasswordExistsForUsername(username);
  }

  async delete(id: string) {
    return await this.app.repository.deleteHashedPasswordAndSaltForId(id);
  }

  hexToArray(input: string) {
    const view = new Uint8Array(input.length / 2);
    for (let i = 0; i < input.length; i += 2) {
      view[i / 2] = parseInt(input.substring(i, i + 2), 16);
    }
    return view;
  }

  async hashPassword(
    password: string,
    originalSalt?: string
  ): Promise<{ passwordHashed: string; salt: string }> {
    return new Promise((resolve, reject) => {
      const salt = originalSalt || crypto.randomBytes(16).toString("hex");
      crypto.pbkdf2(
        password,
        salt,
        this.hashIterations,
        this.hashLength,
        this.hashAlgo,
        function (err, hashedPassword) {
          if (err) return reject(err);
          resolve({ passwordHashed: hashedPassword.toString("hex"), salt });
        }
      );
    });
  }
}

export type Password = {
  id: string;
  username: string;
  passwordHashed: string;
  salt: string;
};

export interface IPasswordsRepository {
  listAllUsers(): Promise<Password[]>;
  createHashedPasswordAndSaltForUsernameAndProfileId(
    username: string,
    profileId: string,
    passwordHashed: string,
    salt: string
  ): Promise<string>;
  updateHashedPasswordAndSaltForUsername(
    username: string,
    passwordHashed: string,
    salt: string
  ): Promise<number>;
  getHashedPasswordAndSaltForUsername(
    username: string
  ): Promise<
    | undefined
    | { id: string; passwordHashed: string; salt: string; profileId: string }
  >;
  checkIfPasswordExistsForUsername(username: string): Promise<boolean>;
  getUsernameById(id: string): Promise<undefined | string>;
  getIdByUsername(username: string): Promise<undefined | string>;
  deleteHashedPasswordAndSaltForId(username: string): Promise<string>;
}
