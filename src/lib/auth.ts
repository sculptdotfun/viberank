import type { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import type { GitHubProfile } from "@/types/auth";
import { serverEnv, validateServerEnv } from "@/lib/env";
import { createSupabaseServerDataLayer } from "@/lib/data/supabase/client";

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
  events: {
    /**
     * Keep the address GitHub gives us. The `user:email` scope has been
     * requested since launch and the provider backfills a private primary
     * from /user/emails when the public one is null, so this arrives for
     * nearly everyone — it was simply never stored anywhere.
     *
     * An event, not a callback: nothing here should be able to fail a
     * sign-in. It also keeps the address off the session, so it never
     * reaches the browser — the only reader is a service-role query.
     */
    async signIn({ user, profile }) {
      const username = (profile as GitHubProfile | undefined)?.login;
      const email = user?.email;
      if (!username || !email) return;

      try {
        const data = createSupabaseServerDataLayer();
        await data.profiles.recordSignInEmail(username, email);
      } catch (error) {
        // A missing service-role key or a transient write failure must not
        // cost the user their sign-in; the next one will try again.
        console.error("[auth] failed to record sign-in email", error);
      }
    },
  },
  pages: {
    signIn: "/",
  },
};
