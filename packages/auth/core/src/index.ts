import { Module } from "@nestjs/common";
import { ConfigModule, DatabaseModule } from "@s2h/core";
import { AuthController } from "./controllers";
import { JwtService, UserService } from "./services";
import { CreateUserCommandHandler, LoginCommandHandler, VerifyUserCommandHandler } from "./commands";
import { CqrsModule } from "@nestjs/cqrs";

@Module( {
	imports: [ ConfigModule, DatabaseModule, CqrsModule ],
	controllers: [ AuthController ],
	providers: [ JwtService, UserService, LoginCommandHandler, CreateUserCommandHandler, VerifyUserCommandHandler ],
	exports: [ JwtService ]
} )
export class AuthModule {}

export * from "./guards";
export * from "./decorators";
