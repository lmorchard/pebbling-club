import assert from "node:assert";
import { describe, it, before, mock } from "node:test";
import { Password, PasswordService, IPasswordsRepository } from "./passwords";
import { MockApp } from "../app/mocks";

describe("services/passwords", () => {
  const username = "johndoe";
  const password = "hunter23";
  const passwordIncorrect = "trustno1";
  const id = "8675309";
  const profileId = "skibidi";
  const salt = "343cd9bd7aa6bbbdc775bc154994f273";

  let app: MockApp;
  let repository: IPasswordsRepository;
  let passwords: PasswordService;

  before(() => {
    app = new MockApp();
    repository = new MockPasswordsRepository();
    passwords = new PasswordService({ app, repository });
  });

  it("should create with a random salt each time", async () => {
    const mockCreate = mock.method(
      repository,
      "createHashedPasswordAndSaltForUsernameAndProfileId",
      (
        username: string,
        profileId: string,
        passwordHashed: string,
        salt: string
      ) => id
    );

    const resultId1 = await passwords.create(
      { username, id: profileId },
      password
    );
    assert.equal(resultId1, id);

    assert.equal(mockCreate.mock.callCount(), 1);
    const call0 = mockCreate.mock.calls[0];
    const salt0 = call0.arguments[2];

    const resultId2 = await passwords.create(
      { username, id: profileId },
      password
    );
    assert.equal(resultId2, id);

    assert.equal(mockCreate.mock.callCount(), 2);
    const call1 = mockCreate.mock.calls[1];
    const salt1 = call1.arguments[2];

    assert.notEqual(salt0, salt1);
  });

  it("should create the same hashed password given the same salt", async () => {
    const mockCreate = mock.method(
      repository,
      "createHashedPasswordAndSaltForUsernameAndProfileId",
      (
        username: string,
        profileId: string,
        passwordHashed: string,
        salt: string
      ) => id
    );

    const resultId1 = await passwords.create(
      { username, id: profileId },
      password,
      salt
    );
    assert.equal(resultId1, id);

    assert.equal(mockCreate.mock.callCount(), 1);
    const hashedPassword = mockCreate.mock.calls[0].arguments[2];

    assert.deepStrictEqual(mockCreate.mock.calls[0].arguments, [
      username,
      profileId,
      hashedPassword,
      salt,
    ]);

    const resultId2 = await passwords.create(
      { username, id: profileId },
      password,
      salt
    );
    assert.equal(resultId2, id);

    assert.equal(mockCreate.mock.callCount(), 2);
    assert.deepStrictEqual(mockCreate.mock.calls[1].arguments, [
      username,
      profileId,
      hashedPassword,
      salt,
    ]);
  });

  it("should be able to verify a password", async () => {
    const { passwordHashed } = await passwords.hashPassword(password, salt);

    const mockGet = mock.method(
      repository,
      "getHashedPasswordAndSaltForUsername",
      (username: string) => ({ id, passwordHashed, salt, profileId })
    );

    const result0 = await passwords.verify(username, password);
    assert.equal(mockGet.mock.callCount(), 1);
    assert.ok(typeof result0 !== "undefined");

    const result1 = await passwords.verify(username, passwordIncorrect);
    assert.equal(mockGet.mock.callCount(), 2);
    assert.ok(typeof result1 === "undefined");
  });
});

class MockPasswordsRepository implements IPasswordsRepository {
  listAllUsers(): Promise<Password[]> {
    throw new Error("Method not implemented.");
  }
  createHashedPasswordAndSaltForUsernameAndProfileId(
    username: string,
    profileId: string,
    passwordHashed: string,
    salt: string
  ): Promise<string> {
    throw new Error("Method not implemented.");
  }
  updateHashedPasswordAndSaltForUsername(
    username: string,
    passwordHashed: string,
    salt: string
  ): Promise<number> {
    throw new Error("Method not implemented.");
  }
  getHashedPasswordAndSaltForUsername(
    username: string
  ): Promise<
    | undefined
    | { id: string; passwordHashed: string; salt: string; profileId: string }
  > {
    throw new Error("Method not implemented.");
  }
  checkIfPasswordExistsForUsername(username: string): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  getUsernameById(id: string): Promise<undefined | string> {
    throw new Error("Method not implemented.");
  }
  getIdByUsername(username: string): Promise<undefined | string> {
    throw new Error("Method not implemented.");
  }
  deleteHashedPasswordAndSaltForId(username: string): Promise<string> {
    throw new Error("Method not implemented.");
  }
}
