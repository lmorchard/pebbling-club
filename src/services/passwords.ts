import crypto from "crypto";
import { BaseService } from "./base";
import { BaseRepository } from "../repositories/base";
import { BaseApp, BaseLogger } from "../app/types";

export class PasswordService extends BaseService {
  hashIterations: number;
  hashLength: number;
  hashAlgo: string;

  constructor(app: BaseApp) {
    super(app);

    // TODO: make these configurable
    this.hashIterations = 310000;
    this.hashLength = 32;
    this.hashAlgo = "sha256";
  }

  async list() {
    return await this.app.repository.listAllUsers();
  }

  async create(username: string, password: string, originalSalt?: string) {
    const { hashedPassword, salt } = await this.hashPassword(
      password,
      originalSalt
    );
    const userId = await this.app.repository.createHashedPasswordAndSaltForUsername(
      username,
      hashedPassword,
      salt
    );
    return userId;
  }

  async update(username: string, password: string) {
    const { hashedPassword, salt } = await this.hashPassword(password);
    return await this.app.repository.updateHashedPasswordAndSaltForUsername(
      username,
      hashedPassword,
      salt
    );
  }

  async verify(username: string, password: string) {
    const result = await this.app.repository.getHashedPasswordAndSaltForUsername(
      username
    );
    if (!result) return;

    const { id, hashedPassword, salt } = result;

    const { hashedPassword: submittedHashedPassword } = await this.hashPassword(
      password,
      salt
    );

    const verified = crypto.timingSafeEqual(
      this.hexToArray(submittedHashedPassword),
      this.hexToArray(hashedPassword)
    );

    return verified ? id : undefined;
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
  ): Promise<{ hashedPassword: string; salt: string }> {
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
          resolve({ hashedPassword: hashedPassword.toString("hex"), salt });
        }
      );
    });
  }
}
