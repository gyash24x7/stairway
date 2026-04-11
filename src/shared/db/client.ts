import { passkeys, users, webauthnOptions } from "@/shared/db/schema";
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";

export const db = drizzle( env.DB, { schema: { users, passkeys, webauthnOptions } } );