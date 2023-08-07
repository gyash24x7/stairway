import { Injectable, NotFoundException } from "@nestjs/common";
import { Collection, ObjectId } from "mongodb";
import {
	ILiteratureGame,
	ILiteratureGameHand,
	ILiteratureMove,
	LiteratureGame,
	LiteratureGameHand,
	LiteratureMove,
	LiteratureMoveType
} from "@literature/data";
import { DatabaseClient } from "@s2h/utils";
import type { CardHand } from "@s2h/cards";

export const LITERATURE_DB = "literature";
export const GAMES_COLLECTION = "games";
export const HANDS_COLLECTION = "hands";
export const MOVES_COLLECTION = "moves";

@Injectable()
export class LiteratureService {

	private readonly games: Collection<ILiteratureGame>;
	private readonly hands: Collection<ILiteratureGameHand>;
	private readonly moves: Collection<ILiteratureMove>;

	constructor( readonly client: DatabaseClient ) {
		this.games = client.db( LITERATURE_DB ).collection( GAMES_COLLECTION );
		this.hands = client.db( LITERATURE_DB ).collection( HANDS_COLLECTION );
		this.moves = client.db( LITERATURE_DB ).collection( MOVES_COLLECTION );
	}

	async saveGame( game: LiteratureGame ) {
		await this.games.updateOne( { _id: new ObjectId( game.id ) }, game.serialize() );
	}

	async findGameById( id: string ) {
		const data = await this.games.findOne( { _id: new ObjectId( id ) } );

		if ( !data ) {
			throw new NotFoundException();
		}

		return LiteratureGame.from( { ...data, id: data._id.toHexString() } );
	}

	async findGameByCode( code: string ) {
		const data = await this.games.findOne( { code } );

		if ( !data ) {
			throw new NotFoundException();
		}

		return LiteratureGame.from( { ...data, id: data._id.toHexString() } );
	}

	async saveHand( hand: LiteratureGameHand ) {
		await this.hands.updateOne( { _id: new ObjectId( hand.id ) }, hand.serialize() );
	}

	async updateHand( gameId: string, playerId: string, hand: CardHand ) {
		return this.hands.findOneAndUpdate(
			{ gameId, playerId },
			{ $set: { hand: hand.serialize() } }
		);
	}

	async findHandsForGame( gameId: string ) {
		return this.hands.find( { gameId } ).toArray();
	}

	async saveMove( move: LiteratureMove ) {
		await this.moves.updateOne( { _id: new ObjectId( move.id ) }, move.serialize() );
	}

	async findLastCallMove( gameId: string ) {
		const [ lastMove ] = await this.moves.find( { gameId, type: LiteratureMoveType.CALL_SET } )
			.sort( { _id: -1 } )
			.limit( 1 )
			.toArray();

		return lastMove;
	}
}