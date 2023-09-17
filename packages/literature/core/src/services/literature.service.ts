import { Injectable, NotFoundException } from "@nestjs/common";
import { Collection, ObjectId } from "mongodb";
import type { ILiteratureGame, ILiteratureGameHand, ILiteratureMove } from "@literature/data";
import { LiteratureGame, LiteratureGameHand, LiteratureMove, LiteratureMoveType } from "@literature/data";
import { DatabaseClient } from "@s2h/core";
import type { CardHand } from "@s2h/cards";
import { DbConstants } from "../constants";

@Injectable()
export class LiteratureService {

	private readonly games: Collection<ILiteratureGame>;
	private readonly hands: Collection<ILiteratureGameHand>;
	private readonly moves: Collection<ILiteratureMove>;

	constructor( readonly client: DatabaseClient ) {
		this.games = client.db( DbConstants.LITERATURE_DB ).collection( DbConstants.GAMES_COLLECTION );
		this.hands = client.db( DbConstants.LITERATURE_DB ).collection( DbConstants.HANDS_COLLECTION );
		this.moves = client.db( DbConstants.LITERATURE_DB ).collection( DbConstants.MOVES_COLLECTION );
	}


	async createGame( game: LiteratureGame ) {
		await this.games.insertOne( game.serialize() );
	}


	async saveGame( game: LiteratureGame ) {
		await this.games.updateOne( { _id: new ObjectId( game.id ) }, { $set: game.serialize() } );
	}


	async findGameById( id: string ) {
		const data = await this.games.findOne( { _id: new ObjectId( id ) } );

		if ( !data ) {
			throw new NotFoundException();
		}

		return LiteratureGame.from( data._id.toHexString(), data );
	}


	async findGameByCode( code: string ) {
		const data = await this.games.findOne( { code } );

		if ( !data ) {
			throw new NotFoundException();
		}

		return LiteratureGame.from( data._id.toHexString(), data );
	}

	async saveHand( hand: LiteratureGameHand ) {
		await this.hands.updateOne( { _id: new ObjectId( hand.id ) }, { $set: hand.serialize() } );
	}


	async updateHand( gameId: string, playerId: string, hand: CardHand ) {
		return this.hands.findOneAndUpdate(
			{ gameId, playerId },
			{ $set: { hand: hand.serialize() } }
		);
	}


	async findHandsForGame( gameId: string ) {
		const hands = await this.hands.find( { gameId } ).toArray();
		return hands.map( data => {
			return LiteratureGameHand.from( { ...data, id: data._id.toHexString() } );
		} );
	}


	async findMovesForGame( gameId: string ) {
		const moves = await this.moves.find( { gameId } ).toArray();
		return moves.map( data => {
			return LiteratureMove.from( data._id.toHexString(), data );
		} );
	}


	async saveMove( move: LiteratureMove ) {
		await this.moves.updateOne( { _id: new ObjectId( move.id ) }, { $set: move.serialize() } );
	}


	async findLastCallMove( gameId: string ) {
		const [ lastMove ] = await this.moves.find( { gameId, type: LiteratureMoveType.CALL_SET } )
			.sort( { _id: -1 } )
			.limit( 1 )
			.toArray();

		return LiteratureMove.from( lastMove._id.toHexString(), lastMove );
	}
}