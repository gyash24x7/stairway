import { Injectable } from "@nestjs/common";
import { LoggerFactory } from "@shared/api";
import { WordleRepository } from "./wordle.repository.ts";

@Injectable()
export class WordleQueries {

	private readonly logger = LoggerFactory.getLogger( WordleQueries );

	constructor( private readonly repository: WordleRepository ) {}

	async getGameDate( gameId: string ) {
		this.logger.debug( ">> getGameData()" );

		const data = await this.repository.getGameById( gameId );

		this.logger.debug( "<< getGameData()" );
		return data;
	}
}