import { matches, matchPlayers, passkeys, relations, users, webauthnOptions } from "@/shared/db/schema";
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";

const schema = { users, passkeys, matches, matchPlayers, webauthnOptions };
export const db = drizzle( env.DB, { schema, relations } );