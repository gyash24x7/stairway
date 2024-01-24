import { Global, Module } from "@nestjs/common";
import { AuthMiddleware } from "./auth.middleware";

@Global()
@Module( {
	providers: [ AuthMiddleware ],
	exports: [ AuthMiddleware ]
} )
export class AuthModule {}