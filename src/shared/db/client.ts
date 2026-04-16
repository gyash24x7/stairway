import { games, passkeys, users, webauthnOptions } from "@/shared/db/schema";
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";

const schema = { users, passkeys, games, webauthnOptions };
export const db = drizzle( env.DB, { schema } );