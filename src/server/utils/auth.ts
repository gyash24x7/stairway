import { generateAvatar } from "@/server/utils/generator";
import { prisma } from "@/server/utils/prisma";
import type { Auth } from "@/types/auth";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { cache } from "react";

const auth = betterAuth( {
	database: prismaAdapter( prisma.auth, {
		provider: "postgresql"
	} ),
	advanced: {
		generateId: false,
		cookiePrefix: "s2h"
	},
	databaseHooks: {
		user: {
			create: {
				before: async ( user ) => ( { data: { ...user, image: generateAvatar( user.id ) } } )
			}
		}
	},
	trustedOrigins: [
		"http://localhost:3000",
		"https://stairway.yashgupta.me"
	],
	plugins: [
		nextCookies()
	],
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
			redirectURI: process.env.GOOGLE_REDIRECT_URI
		}
	}
} );

export const handler = auth.handler;

export const getAuthInfo = cache( async (): Promise<Auth.Info | null> => {
	const session = await auth.api.getSession( {
		headers: await headers()
	} );

	if ( !session ) {
		return null;
	}

	return { ...session.user, avatar: session.user.image ?? "" };
} );