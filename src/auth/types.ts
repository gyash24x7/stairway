import type * as schema from "@/auth/schema";

export type AuthInfo = {
	id: string;
	name: string;
	username: string;
	avatar: string;
}

export type AuthContext = {
	authInfo: AuthInfo;
}

export type User = typeof schema.users.$inferSelect;
export type Passkey = typeof schema.passkeys.$inferSelect;