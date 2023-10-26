import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {

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
			move: this.prismaClient.literatureMove
		};
	}

	async onModuleInit() {
		this.prismaClient.$connect();
	}

	async onModuleDestroy() {
		this.prismaClient.$disconnect();
	}
}
