import { Controller } from "@nestjs/common";
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
import { GrpcMethod } from "@nestjs/microservices";
import { LiteratureCollection } from "../db";
import { Collection } from "mongodb";
import { ILiteratureGame, LiteratureGame } from "@s2h/literature/utils";
import { IUser } from "@s2h/utils";
import { Metadata, ServerUnaryCall } from "@grpc/grpc-js";


export interface ILiteratureService {
	askCard(
		input: AskCardInput,
		metaData: Metadata,
		call: ServerUnaryCall<AskCardInput, ILiteratureGame>
	): Promise<ILiteratureGame>;

	callSet(
		input: CallSetInput,
		metaData: Metadata,
		call: ServerUnaryCall<CallSetInput, ILiteratureGame>
	): Promise<ILiteratureGame>;

	chanceTransfer(
		input: ChanceTransferInput,
		metaData: Metadata,
		call: ServerUnaryCall<ChanceTransferInput, ILiteratureGame>
	): Promise<ILiteratureGame>;

	createGame(
		input: CreateGameInput,
		metaData: Metadata,
		call: ServerUnaryCall<CreateGameInput, ILiteratureGame>
	): Promise<ILiteratureGame>;

	createTeams(
		input: CreateTeamsInput,
		metaData: Metadata,
		call: ServerUnaryCall<CreateTeamsInput, ILiteratureGame>
	): Promise<ILiteratureGame>;

	getGame(
		input: GetGameInput,
		metaData: Metadata,
		call: ServerUnaryCall<GetGameInput, ILiteratureGame>
	): Promise<ILiteratureGame>;

	joinGame(
		input: JoinGameInput,
		metaData: Metadata,
		call: ServerUnaryCall<JoinGameInput, ILiteratureGame>
	): Promise<ILiteratureGame>;

	startGame(
		input: StartGameInput,
		metaData: Metadata,
		call: ServerUnaryCall<StartGameInput, ILiteratureGame>
	): Promise<ILiteratureGame>;
}

@Controller()
export class LiteratureService implements ILiteratureService {

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