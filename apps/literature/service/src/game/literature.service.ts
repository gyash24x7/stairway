import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import { ILiteratureGame, LiteratureGame } from "@s2h/literature/utils";
import { IUser } from "@s2h/utils";
import { Collection } from "mongodb";
import { LiteratureCollection } from "../db";
import {
	AskCardInput,
	CallSetInput,
	ChanceTransferInput,
	CreateGameInput,
	CreateTeamsInput,
	GetGameInput,
	JoinGameInput,
	StartGameInput
} from "./game.inputs";

@Controller()
export class LiteratureService {

	constructor( @LiteratureCollection() private readonly collection: Collection<ILiteratureGame> ) {}

	@GrpcMethod()
	createGame( input: CreateGameInput ) {
		const game = LiteratureGame.create( input.playerCount, {} as IUser );
		return this.collection.insertOne( game.serialize() ).then( () => game );
	}

	@GrpcMethod()
	async joinGame( input: JoinGameInput ) {
		const game = LiteratureGame.create( input.loggedInPlayerId.length, {} as IUser );
		return this.collection.insertOne( game.serialize() ).then( () => game );
	}

	@GrpcMethod()
	createTeams( input: CreateTeamsInput ) {
		const game = LiteratureGame.create( input.gameId.length, {} as IUser );
		return this.collection.insertOne( game.serialize() ).then( () => game );
	}

	@GrpcMethod()
	startGame( input: StartGameInput ) {
		const game = LiteratureGame.create( input.gameId.length, {} as IUser );
		return this.collection.insertOne( game.serialize() ).then( () => game );
	}

	@GrpcMethod()
	askCard( input: AskCardInput ) {
		const game = LiteratureGame.create( input.gameId.length, {} as IUser );
		return this.collection.insertOne( game.serialize() ).then( () => game );
	}

	@GrpcMethod()
	callSet( input: CallSetInput ) {
		const game = LiteratureGame.create( input.gameId.length, {} as IUser );
		return this.collection.insertOne( game.serialize() ).then( () => game );
	}

	@GrpcMethod()
	chanceTransfer( input: ChanceTransferInput ) {
		const game = LiteratureGame.create( input.gameId.length, {} as IUser );
		return this.collection.insertOne( game.serialize() ).then( () => game );
	}

	@GrpcMethod()
	getGame( input: GetGameInput ) {
		const game = LiteratureGame.create( input.gameId.length, {} as IUser );
		return this.collection.insertOne( game.serialize() ).then( () => game );
	}
}