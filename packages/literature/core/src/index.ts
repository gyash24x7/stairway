import { Module } from "@nestjs/common";
import { GamesController } from "./controllers";
import { DatabaseModule } from "@s2h/core";
import { LiteratureService } from "./services";
import { AuthModule } from "@auth/core";
import {
	AskCardCommandHandler,
	CallSetCommandHandler,
	CreateGameCommandHandler,
	CreateTeamsCommandHandler,
	JoinGameCommandHandler,
	StartGameCommandHandler,
	TransferChanceCommandHandler
} from "./commands";
import { AggregateGameQueryHandler } from "./queries";
import { CqrsModule } from "@nestjs/cqrs";

@Module( {
	imports: [ DatabaseModule, AuthModule, CqrsModule ],
	controllers: [ GamesController ],
	providers: [
		LiteratureService,
		CreateGameCommandHandler,
		JoinGameCommandHandler,
		CreateTeamsCommandHandler,
		StartGameCommandHandler,
		AskCardCommandHandler,
		CallSetCommandHandler,
		TransferChanceCommandHandler,
		AggregateGameQueryHandler
	]
} )
export class LiteratureModule {}