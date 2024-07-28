import crypto from "crypto";
import { BaseRepository } from "../repositories/base";
import { BaseService } from "./base";

export class PasswordService extends BaseService {
  hashIterations: number;
  hashLength: number;
  hashAlgo: string;

  constructor(repository: BaseRepository) {
    super(repository);

    // TODO: make these configurable
    this.hashIterations = 310000;
    this.hashLength = 32;
    this.hashAlgo = "sha256";
  }

  async create(username: string, password: string, originalSalt?: string) {
    const { hashedPassword, salt } = await this.hashPassword(
      password,
      originalSalt
    );
    const userId = await this.repository.createHashedPasswordAndSaltForUsername(
      username,
      hashedPassword,
      salt
    );
    return userId;
  }

  async update(username: string, password: string) {
    const { hashedPassword, salt } = await this.hashPassword(password);
    await this.repository.updateHashedPasswordAndSaltForUsername(
      username,
      hashedPassword,
      salt
    );
  }

  async verify(username: string, password: string) {
    const result = await this.repository.getHashedPasswordAndSaltForUsername(
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

  async get(id: string) {
    const result = await this.repository.getUsernameForId(id);
    return result ? result : undefined;
  }

  async delete(username: string) {
    await this.repository.deleteHashedPasswordAndSaltForUsername(username);
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
