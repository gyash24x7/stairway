import { Injectable, NotFoundException } from "@nestjs/common";
import { Collection, ObjectId } from "mongodb";
import {
	CallbreakDeal,
	CallbreakGame,
	CallbreakHand,
	ICallbreakDeal,
	ICallbreakGame,
	ICallbreakHand
} from "@callbreak/data";
import { DatabaseClient } from "@s2h/utils";
import type { CardHand } from "@s2h/cards";

export const CALLBREAK_DB = "callbreak";
export const GAMES_COLLECTION = "games";
export const HANDS_COLLECTION = "hands";
export const DEALS_COLLECTION = "deals";

@Injectable()
export class CallbreakService {

	private readonly games: Collection<ICallbreakGame>;
	private readonly hands: Collection<ICallbreakHand>;
	private readonly deals: Collection<ICallbreakDeal>;

	constructor( readonly client: DatabaseClient ) {
		this.games = client.db( CALLBREAK_DB ).collection( GAMES_COLLECTION );
		this.hands = client.db( CALLBREAK_DB ).collection( HANDS_COLLECTION );
		this.deals = client.db( CALLBREAK_DB ).collection( DEALS_COLLECTION );
	}

	async saveGame( game: CallbreakGame ) {
		await this.games.updateOne( { _id: new ObjectId( game.id ) }, game.serialize() );
	}

	async findGameById( id: string ) {
		const data = await this.games.findOne( { _id: new ObjectId( id ) } );

		if ( !data ) {
			throw new NotFoundException();
		}

		return CallbreakGame.from( { ...data, id: data._id.toHexString() } );
	}

	async findGameByCode( code: string ) {
		const data = await this.games.findOne( { code } );

		if ( !data ) {
			throw new NotFoundException();
		}

		return CallbreakGame.from( { ...data, id: data._id.toHexString() } );
	}

	async saveHand( hand: CallbreakHand ) {
		await this.hands.updateOne( { _id: new ObjectId( hand.id ) }, hand.serialize() );
	}

	async updateHand( gameId: string, playerId: string, hand: CardHand ) {
		return this.hands.findOneAndUpdate(
			{ gameId, playerId },
			{ $set: { hand: hand.serialize() } }
		);
	}

	async findDealsForGame( gameId: string ) {
		return this.deals.find( { gameId } ).toArray();
	}

	async findHandsForGame( gameId: string ) {
		return this.hands.find( { gameId } ).toArray();
	}

	async saveDeal( deal: CallbreakDeal ) {
		await this.deals.updateOne( { _id: new ObjectId( deal.id ) }, deal.serialize() );
	}
}