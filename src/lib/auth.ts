import type { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import type { GitHubProfile } from "@/types/auth";
import { serverEnv, validateServerEnv } from "@/lib/env";

validateServerEnv();

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: serverEnv.GITHUB_ID,
      clientSecret: serverEnv.GITHUB_SECRET,
      authorization: {
        params: {
          scope: "read:user user:email",
        },
      },
      profile(profile: GitHubProfile) {
        return {
          id: profile.id.toString(),
          name: profile.name || profile.login,
          email: profile.email,
          image: profile.avatar_url,
          username: profile.login,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.username = (profile as GitHubProfile).login;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.sub!;
        session.user.username = token.username as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};
