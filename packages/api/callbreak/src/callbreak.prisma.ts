import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";

@Injectable()
export class CallBreakPrisma {

	constructor(
		@Inject( "PRISMA_CLIENT" )
		private readonly prisma: PrismaClient
	) {}

	get player() {
		return this.prisma.callBreakPlayer;
	}

	get game() {
		return this.prisma.callBreakGame;
	}

	get round() {
		return this.prisma.callBreakRound;
	}

	get deal() {
		return this.prisma.callBreakDeal;
	}

	get cardMapping() {
		return this.prisma.callBreakCardMapping;
	}
}