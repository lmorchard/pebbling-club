import assert from "node:assert";
import { describe, it, before, after, mock, Mock } from "node:test";
import { PasswordService } from "./passwords";
import { MockApp, MockRepository } from "../app/mocks";
import { BaseRepository } from "../repositories/base";

describe("services.passwords", () => {
  const username = "johndoe";
  const password = "hunter23";
  const passwordIncorrect = "trustno1";
  const id = "8675309";
  const salt = "343cd9bd7aa6bbbdc775bc154994f273";

  let app: MockApp;
  let passwords: PasswordService;

  before(() => {
    app = new MockApp();
    // @ts-ignore
    app.repository.createHashedPasswordAndSaltForUsername = () => {};
    // @ts-ignore
    app.repository.getHashedPasswordAndSaltForUsername = () => {};

    passwords = new PasswordService(app);
  });

  it("should create with a random salt each time", async () => {
    const mockCreate = mock.method(
      app.repository,
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
      app.repository,
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

    const mockGet = mock.method(
      app.repository,
      "getHashedPasswordAndSaltForUsername",
      (username: string) => ({ id, hashedPassword, salt })
    );

    const result0 = await passwords.verify(username, password);
    assert.equal(mockGet.mock.callCount(), 1);
    assert.ok(typeof result0 !== "undefined");

    const result1 = await passwords.verify(username, passwordIncorrect);
    assert.equal(mockGet.mock.callCount(), 2);
    assert.ok(typeof result1 === "undefined");
  });

});
