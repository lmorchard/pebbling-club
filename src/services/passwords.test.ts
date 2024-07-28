import assert from "node:assert";
import { describe, it, before, after, mock } from "node:test";
import { PasswordService } from "./passwords";
import { MockRepository } from "../utils/mocks";

describe("play", () => {
  let repository: MockRepository;
  let passwords: PasswordService;

  const username = "johndoe";
  const password = "hunter23";
  const passwordIncorrect = "trustno1";
  const id = "8675309";
  const salt = "343cd9bd7aa6bbbdc775bc154994f273";

  before(() => {
    repository = new MockRepository();
    passwords = new PasswordService(repository);
  });

  it("should create with a random salt each time", async () => {
    const mockCreate = mock.method(
      repository,
      "createHashedPasswordAndSaltForUsername",
      (username: string, password: string) => id
    );

    const resultId1 = await passwords.create(username, password);
    assert.equal(resultId1, id);

    assert.equal(mockCreate.mock.callCount(), 1);
    const call0 = mockCreate.mock.calls[0];
    const salt0 = call0.arguments[2];

    const resultId2 = await passwords.create(username, password);
    assert.equal(resultId2, id);

    assert.equal(mockCreate.mock.callCount(), 2);
    const call1 = mockCreate.mock.calls[1];
    const salt1 = call1.arguments[2];

    assert.notEqual(salt0, salt1);
  });

  it("should create the same hashed password given the same salt", async () => {
    const mockCreate = mock.method(
      repository,
      "createHashedPasswordAndSaltForUsername",
      (username: string, password: string) => id
    );

    const resultId1 = await passwords.create(username, password, salt);
    assert.equal(resultId1, id);

    assert.equal(mockCreate.mock.callCount(), 1);
    const hashedPassword = mockCreate.mock.calls[0].arguments[1];

    assert.deepStrictEqual(mockCreate.mock.calls[0].arguments, [
      username,
      hashedPassword,
      salt,
    ]);

    const resultId2 = await passwords.create(username, password, salt);
    assert.equal(resultId2, id);

    assert.equal(mockCreate.mock.callCount(), 2);
    assert.deepStrictEqual(mockCreate.mock.calls[1].arguments, [
      username,
      hashedPassword,
      salt,
    ]);
  });

  it("should be able to verify a password", async () => {
    const { hashedPassword } = await passwords.hashPassword(password, salt);

    const mockCreate = mock.method(
      repository,
      "getHashedPasswordAndSaltForUsername",
      (username: string) => ({ hashedPassword, salt })
    );

    const result0 = await passwords.verify(username, password);
    assert.equal(mockCreate.mock.callCount(), 1);
    assert(result0);

    const result1 = await passwords.verify(username, passwordIncorrect);
    assert.equal(mockCreate.mock.callCount(), 2);
    assert(!result1);
  });

});
