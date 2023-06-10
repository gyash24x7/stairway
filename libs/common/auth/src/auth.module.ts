import { Module } from "@nestjs/common";
import { JwtService } from "./jwt.service";
import { ConfigModule, DatabaseModule } from "@s2h/utils";
import { IUser, USERS_COLLECTION } from "./auth.types";

@Module( {
	imports: [
		ConfigModule,
		DatabaseModule.register( client => {
			return { users: () => client.db().collection<IUser>( USERS_COLLECTION ) };
		} )
	],
	providers: [ JwtService ],
	exports: [ JwtService ]
} )
export class AuthModule {}
