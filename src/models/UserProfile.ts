export interface UserProfile {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  preferredLanguage?: string;
}
export function createUser(id: string, username: string, email: string): UserProfile {
  return { id, username, email, createdAt: new Date().toISOString(), preferredLanguage: "en-US" };
}