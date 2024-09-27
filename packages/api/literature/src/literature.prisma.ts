import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";

@Injectable()
export class LiteraturePrisma {

	constructor(
		@Inject( "PRISMA_CLIENT" )
		private readonly prisma: PrismaClient
	) {}

	get player() {
		return this.prisma.literaturePlayer;
	}

	get team() {
		return this.prisma.literatureTeam;
	}

	get cardMapping() {
		return this.prisma.literatureCardMapping;
	}

	get cardLocation() {
		return this.prisma.literatureCardLocation;
	}

	get ask() {
		return this.prisma.literatureAsk;
	}

	get call() {
		return this.prisma.literatureCall;
	}

	get transfer() {
		return this.prisma.literatureTransfer;
	}

	get game() {
		return this.prisma.literatureGame;
	}
}