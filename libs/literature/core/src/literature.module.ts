import { Module } from "@nestjs/common";
import { LiteratureService } from "./services";
import { ConfigModule, DatabaseModule } from "@s2h/utils";
import { Db } from "./types";
import { AuthModule, IUser } from "@s2h/auth";
import { ILiteratureGame, ILiteratureGameHand, ILiteratureMove } from "./models";

export const GAMES_COLLECTION = "literature_games";
export const GAME_HANDS_COLLECTION = "literature_game_hands";
export const GAME_MOVES_COLLECTION = "literature_game_moves";
export const USERS_COLLECTION = "users";

@Module( {
	imports: [
		ConfigModule.register( "literature" ),
		DatabaseModule.register<Db>( client => {
			return {
				users: () => client.db().collection<IUser>( USERS_COLLECTION ),
				games: () => client.db().collection<ILiteratureGame>( GAMES_COLLECTION ),
				hands: () => client.db().collection<ILiteratureGameHand>( GAME_HANDS_COLLECTION ),
				moves: () => client.db().collection<ILiteratureMove<any>>( GAME_MOVES_COLLECTION )
			};
		} ),
		AuthModule,
		LiteratureModule
	],
	providers: [ LiteratureService ]
} )
export class LiteratureModule {}
