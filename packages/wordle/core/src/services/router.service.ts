import { TrpcService } from "@common/core";
import { Injectable } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { createGameInputSchema, type Game, gameIdInputSchema, makeGuessInputSchema } from "@wordle/data";
import { CreateGameCommand, MakeGuessCommand } from "../commands";
import { MiddlewareService } from "./middleware.service";

@Injectable()
export class RouterService {

	constructor(
		private readonly trpc: TrpcService,
		private readonly commandBus: CommandBus,
		private readonly middlewares: MiddlewareService
	) {}

	router() {
		return this.trpc.router( {
			createGame: this.trpc.procedure
				.input( createGameInputSchema )
				.mutation( ( { input, ctx: { authUser } } ) => {
					const command = new CreateGameCommand( input, authUser );
					return this.commandBus.execute<CreateGameCommand, Game>( command );
				} ),

			makeGuess: this.trpc.procedure
				.input( makeGuessInputSchema )
				.use( this.middlewares.gameAndPlayerData() )
				.use( this.middlewares.validateGameInProgress() )
				.mutation( ( { input, ctx: { gameData } } ) => {
					const command = new MakeGuessCommand( input, gameData );
					return this.commandBus.execute<MakeGuessCommand, Game>( command );
				} ),

			getGame: this.trpc.procedure
				.input( gameIdInputSchema )
				.use( this.middlewares.gameAndPlayerData() )
				.query( ( { ctx: { gameData } } ) => gameData )
		} );
	}
}