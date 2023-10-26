import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { JwtModule as NestJwtModule } from "@nestjs/jwt";
import { PrismaModule } from "@s2h/core";
import * as process from "process";
import { commandHandlers } from "./commands";
import { AuthController } from "./controllers";

const JwtModule = NestJwtModule.register( {
	global: true,
	secret: process.env[ "JWT_SECRET" ],
	signOptions: {
		expiresIn: "1d",
		issuer: `http://${ process.env[ "AUTH_DOMAIN" ] }`,
		algorithm: "HS256",
		audience: process.env[ "AUTH_AUDIENCE" ]
	}
} );

@Module( {
	imports: [ PrismaModule, CqrsModule, JwtModule ],
	controllers: [ AuthController ],
	providers: [ ...commandHandlers ]
} )
export class AuthModule {}

export * from "./guards";
export * from "./decorators";
