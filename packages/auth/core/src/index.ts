import { Module } from "@nestjs/common";
import { ConfigModule, PrismaModule } from "@s2h/core";
import { AuthController } from "./controllers";
import { JwtService, services } from "./services";
import { commandHandlers } from "./commands";
import { CqrsModule } from "@nestjs/cqrs";

@Module( {
	imports: [ ConfigModule, PrismaModule, CqrsModule ],
	controllers: [ AuthController ],
	providers: [ ...services, ...commandHandlers ],
	exports: [ JwtService ]
} )
export class AuthModule {}

export * from "./guards";
export * from "./decorators";
