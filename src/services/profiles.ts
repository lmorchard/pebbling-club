import { BaseApp } from "../app/types";
import { BaseService } from "./base";
import { PasswordService } from "./passwords";

export class ProfileService extends BaseService {
  passwords: PasswordService;

  constructor(app: BaseApp, passwords: PasswordService) {
    super(app);
    this.passwords = passwords;
  }

  async usernameExists(username: string) {
    return await this.app.repository.checkIfProfileExistsForUsername(username);
  }

  async create(profile: Profile, options: { password?: string } = {}) {
    const newProfile = await this.app.repository.createProfile(profile);
    if (options.password) {
      await this.passwords.create(profile.username, options.password);
    }
    return newProfile;
  }

  async update(id: string, profile: ProfileEditable) {
    return await this.app.repository.updateProfile(id, profile);
  }

  async get(id: string) {
    return await this.app.repository.getProfile(id);
  }

  async getByUsername(username: string) {
    return await this.app.repository.getProfileByUsername(username);
  }

  async delete(id: string) {
    const existingProfile = await this.get(id);
    if (!existingProfile) throw new Error("profile does not exist");

    // Delete password associated with profile username, if exists.
    const { username } = existingProfile;
    const passwordId = await this.passwords.getIdByUsername(username);
    if (passwordId) {
      await this.passwords.delete(passwordId);
    }

    return await this.app.repository.deleteProfile(id);
  }
}

export type Profile = {
  id?: string;
  username: string;
  bio?: string;
  avatar?: string;
  created?: Date;
  modified?: Date;
};

export type ProfileEditable = Omit<
  Profile, "id" | "username" | "created" | "modified"
>;