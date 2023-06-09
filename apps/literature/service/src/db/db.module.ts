import { Inject, Module } from "@nestjs/common";
import { ILiteratureGame } from "@s2h/literature/utils";
import { IUser } from "@s2h/utils";
import { DatabaseClient } from "./db.client";

const STAIRWAY_DATABASE = "stairway";
const LITERATURE_COLLECTION = "literature";
const USERS_COLLECTION = "users";

export const LiteratureCollection = () => Inject( LITERATURE_COLLECTION );
export const UsersCollection = () => Inject( USERS_COLLECTION );

@Module( {
	providers: [
		DatabaseClient,
		{
			provide: USERS_COLLECTION,
			inject: [ DatabaseClient ],
			useFactory: ( dbClient: DatabaseClient ) => dbClient
				.db( STAIRWAY_DATABASE )
				.collection<IUser>( USERS_COLLECTION )
		},
		{
			provide: LITERATURE_COLLECTION,
			inject: [ DatabaseClient ],
			useFactory: ( dbClient: DatabaseClient ) => dbClient
				.db( STAIRWAY_DATABASE )
				.collection<ILiteratureGame>( LITERATURE_COLLECTION )
		}
	],
	exports: [ DatabaseClient, USERS_COLLECTION, LITERATURE_COLLECTION ]
} )
export class DatabaseModule {}