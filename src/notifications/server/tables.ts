import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import type { UserId } from "@/auth/schema";
import { users } from "@/auth/server/tables";


/**
 * The devices that have asked to be told about a player's games.
 *
 * One row per browser, keyed by `endpoint` — the push service's address for it,
 * which is unique to that browser's subscription. A player with a phone and a
 * laptop has two rows. A row is removed when the player turns notifications off,
 * logs out, or when the push service answers that the subscription is gone.
 *
 * `p256dh` and `auth` are the device's keys for the encryption every push is
 * sent under; the push service relays ciphertext it cannot read.
 */
export const pushSubscriptions = pgTable(
	"push_subscriptions",
	{
		id: uuid().primaryKey().default( sql`uuidv7()` ),
		userId: uuid( "user_id" )
			.notNull()
			.references( () => users.id, { onDelete: "cascade" } )
			.$type<UserId>(),
		endpoint: text().notNull().unique(),
		p256dh: text().notNull(),
		auth: text().notNull(),
		userAgent: text( "user_agent" ),
		createdAt: timestamp( "created_at" ).notNull().defaultNow(),
		lastSuccessAt: timestamp( "last_success_at" )
	},
	table => [
		index( "push_subscriptions_user_id_idx" ).on( table.userId )
	]
);

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
