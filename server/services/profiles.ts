import { BaseService } from "./base";
import { PasswordService } from "./passwords";

export type IAppRequirements = {
  repository: IProfilesRepository;
  passwords: PasswordService;
};

export class ProfileService extends BaseService<IAppRequirements> {
  async usernameExists(username: string) {
    return await this.app.repository.checkIfProfileExistsForUsername(username);
  }

  async create(profile: ProfileCreatable, options: { password?: string } = {}) {
    const newProfile = await this.app.repository.createProfile(profile);
    if (options.password) {
      await this.app.passwords.create(
        { id: newProfile, username: profile.username },
        options.password
      );
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
    const passwordId = await this.app.passwords.getIdByUsername(username);
    if (passwordId) {
      await this.app.passwords.delete(passwordId);
    }

    return await this.app.repository.deleteProfile(id);
  }
}

export type Profile = {
  id: string;
  username: string;
  bio?: string;
  avatar?: string;
  created?: Date;
  modified?: Date;
};

export type ProfileCreatable = Omit<Profile, "id">;

export type ProfileEditable = Omit<
  Profile,
  "id" | "username" | "created" | "modified"
>;

export interface IProfilesRepository {
  checkIfProfileExistsForUsername(username: string): Promise<boolean>;
  createProfile(profile: ProfileCreatable): Promise<string>;
  updateProfile(id: string, profile: ProfileEditable): Promise<void>;
  getProfile(id: string): Promise<Profile>;
  getProfileByUsername(username: string): Promise<Profile>;
  deleteProfile(id: string): Promise<void>;
}
