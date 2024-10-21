import "server-only";

import { prisma } from "@stairway/api/utils";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

export const auth = betterAuth( {
	database: prismaAdapter( prisma.auth, { provider: "postgresql" } ),
	socialProviders: {
		google: {
			clientId: process.env[ "GOOGLE_CLIENT_ID" ]!,
			clientSecret: process.env[ "GOOGLE_CLIENT_SECRET" ]!,
			redirectURI: process.env[ "GOOGLE_REDIRECT_URI" ]
		}
	}
} );
