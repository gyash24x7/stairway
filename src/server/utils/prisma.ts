import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const client = globalForPrisma.prisma || new PrismaClient();

if ( process.env.NODE_ENV !== "production" ) {
	globalForPrisma.prisma = client;
}

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