import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import { prisma, type UserAuthInfo } from "@stairway/api/utils";
import { Google } from "arctic";
import { Lucia } from "lucia";

const adapter = new PrismaAdapter( prisma.auth.session, prisma.auth.user );

export const lucia = new Lucia( adapter, {
	sessionCookie: {
		name: "auth_session",
		expires: false,
		attributes: {
			secure: process.env[ "NODE_ENV" ] === "production"
		}
	},
	getUserAttributes( attributes ) {
		return { ...attributes };
	}
} );

const clientId = process.env[ "GOOGLE_CLIENT_ID" ]!;
const clientSecret = process.env[ "GOOGLE_CLIENT_SECRET" ]!;
const redirectUri = process.env[ "GOOGLE_REDIRECT_URI" ]!;

export const google = new Google( clientId, clientSecret, redirectUri );

declare module "lucia" {
	interface Register {
		Lucia: typeof lucia;
		DatabaseUserAttributes: UserAuthInfo;
	}
}