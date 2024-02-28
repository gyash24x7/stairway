import { Global, Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthMiddleware } from "./auth.middleware";
import { AuthService } from "./auth.service";
import { JwtService } from "./jwt.service";

@Global()
@Module( {
	providers: [ AuthGuard, JwtService, AuthService, AuthMiddleware ],
	controllers: [ AuthController ],
	exports: [ AuthMiddleware, AuthService ]
} )
export class AuthModule {}