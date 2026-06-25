// Augments next-auth types so the runtime callbacks line up with our user model.
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    isAdmin?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    email?: string;
    isAdmin?: boolean;
    // Epoch ms of the last database revalidation; throttles the subject-exists
    // check in the Node jwt callback (see auth.ts).
    checkedAt?: number;
  }
}
