import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";

@Injectable()
export class WordlePrisma {

	constructor(
		@Inject( "PRISMA_CLIENT" )
		private readonly prisma: PrismaClient
	) {}

	get game() {
		return this.prisma.wordleGame;
	}
}