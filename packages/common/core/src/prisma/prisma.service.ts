import { PrismaClient } from "@prisma/client";

export class PrismaService {

	private readonly prismaClient = new PrismaClient();

	get user() {
		return this.prismaClient.user;
	}

	get literature() {
		return {
			game: this.prismaClient.literatureGame,
			player: this.prismaClient.literaturePlayer,
			cardMapping: this.prismaClient.literatureCardMapping,
			team: this.prismaClient.literatureTeam,
			move: this.prismaClient.literatureMove,
			inference: this.prismaClient.literatureInference
		};
	}
}

export const prismaService = new PrismaService();