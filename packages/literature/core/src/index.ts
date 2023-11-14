import { Module, OnModuleInit } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { RealtimeService } from "@s2h/core";
import {
	AddBotsCommandHandler,
	AskCardCommandHandler,
	CallSetCommandHandler,
	CreateGameCommandHandler,
	CreateInferenceCommandHandler,
	CreateTeamsCommandHandler,
	JoinGameCommandHandler,
	StartGameCommandHandler,
	TransferTurnCommandHandler,
	UpdateHandsCommandHandler,
	UpdateInferenceCommandHandler,
	UpdateScoreCommandHandler,
	UpdateStatusCommandHandler,
	UpdateTurnCommandHandler
} from "./commands";
import { GamesController } from "./controllers";
import {
	GameStartedEventHandler,
	HandsUpdatedEventHandler,
	InferenceUpdatedEvent,
	MoveCreatedEventHandler,
	PlayerJoinedEventHandler,
	ScoreUpdatedEventHandler,
	StatusUpdatedEventHandler,
	TeamsCreatedEventHandler,
	TurnUpdatedEventHandler
} from "./events";
import {
	CardsDataQueryHandler,
	GameDataQueryHandler,
	InferenceDataQueryHandler,
	PlayerSpecificDataQueryHandler
} from "./queries";
import { CardsDataTransformer, GameDataTransformer } from "./transformers";
import {
	AddBotsValidator,
	AskCardValidator,
	CallSetValidator,
	CreateTeamsValidator,
	JoinGameValidator,
	TransferTurnValidator
} from "./validators";

@Module( {
	imports: [ CqrsModule ],
	controllers: [ GamesController ],
	providers: [
		CreateGameCommandHandler,
		JoinGameCommandHandler,
		AddBotsCommandHandler,
		CreateTeamsCommandHandler,
		StartGameCommandHandler,
		AskCardCommandHandler,
		CallSetCommandHandler,
		TransferTurnCommandHandler,
		CreateInferenceCommandHandler,
		UpdateHandsCommandHandler,
		UpdateInferenceCommandHandler,
		UpdateScoreCommandHandler,
		UpdateStatusCommandHandler,
		UpdateTurnCommandHandler,
		GameDataQueryHandler,
		PlayerSpecificDataQueryHandler,
		CardsDataQueryHandler,
		InferenceDataQueryHandler,
		GameStartedEventHandler,
		HandsUpdatedEventHandler,
		InferenceUpdatedEvent,
		MoveCreatedEventHandler,
		PlayerJoinedEventHandler,
		ScoreUpdatedEventHandler,
		StatusUpdatedEventHandler,
		TeamsCreatedEventHandler,
		TurnUpdatedEventHandler,
		AddBotsValidator,
		AskCardValidator,
		CallSetValidator,
		CreateTeamsValidator,
		JoinGameValidator,
		TransferTurnValidator,
		GameDataTransformer,
		CardsDataTransformer
	]
} )
export class LiteratureModule implements OnModuleInit {

	constructor( private readonly realtimeService: RealtimeService ) {}

	onModuleInit() {
		this.realtimeService.registerNamespace( "literature" );
	}
}