import { prisma } from "@stairway/prisma";
import { generateAvatar } from "@stairway/utils";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

export const auth = betterAuth( {
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
	socialProviders: {
		google: {
			clientId: Bun.env.GOOGLE_CLIENT_ID,
			clientSecret: Bun.env.GOOGLE_CLIENT_SECRET,
			redirectURI: Bun.env.GOOGLE_REDIRECT_URI
		}
	}
} );