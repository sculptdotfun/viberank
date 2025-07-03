import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      username?: string;
    } & DefaultSession["user"];
  }

  interface User {
    username?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    username?: string;
  }
}

export interface GitHubProfile {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}