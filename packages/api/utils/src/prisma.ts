import { PrismaClient } from "@prisma/client";

const client = new PrismaClient();

export const prisma = {
	auth: {
		user: client.user,
		session: client.session
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