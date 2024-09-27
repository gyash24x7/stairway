import { Injectable } from "@nestjs/common";
import { OgmaLogger, OgmaService } from "@ogma/nestjs-module";
import { WordlePrisma } from "./wordle.prisma.ts";

@Injectable()
export class WordleQueries {

	constructor(
		private readonly prisma: WordlePrisma,
		@OgmaLogger( WordleQueries ) private readonly logger: OgmaService
	) {}

	async getGameDate( gameId: string ) {
		this.logger.debug( ">> getGameData()" );
		const data = await this.prisma.game.findUnique( { where: { id: gameId } } );
		this.logger.debug( "<< getGameData()" );
		return data;
	}
}