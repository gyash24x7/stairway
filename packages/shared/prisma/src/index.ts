import { prisma as client } from "./client";

export const prisma = {
	auth: {
		user: client.user,
		session: client.session,
		account: client.account,
		verification: client.verification
	},
	wordle: {
		game: client.wordleGame
	},
	literature: {
		game: client.literatureGame,
		player: client.literaturePlayer,
		team: client.literatureTeam,
		cardMapping: client.literatureCardMapping,
		cardLocation: client.literatureCardLocation,
		ask: client.literatureAsk,
		call: client.literatureCall,
		transfer: client.literatureTransfer
	},
	callbreak: {
		game: client.callBreakGame,
		player: client.callBreakPlayer,
		cardMapping: client.callBreakCardMapping,
		deal: client.callBreakDeal,
		round: client.callBreakRound
	}
};

export * from "./generated";

declare module "bun" {
	interface Env {
		FRONTEND_URL: string;
		DATABASE_URL: string;
		BETTER_AUTH_URL: string;
		BETTER_AUTH_SECRET: string;
		GOOGLE_CLIENT_ID: string;
		GOOGLE_CLIENT_SECRET: string;
		GOOGLE_REDIRECT_URI: string;
	}
}