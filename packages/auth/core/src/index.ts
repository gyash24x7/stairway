import { Module } from "@nestjs/common";
import { ConfigModule, DatabaseModule } from "@s2h/utils";
import { AuthController } from "./controllers";
import { JwtService } from "./services";

@Module( {
	imports: [ ConfigModule, DatabaseModule ],
	controllers: [ AuthController ],
	providers: [ JwtService ],
	exports: [ JwtService ]
} )
export class AuthModule {}

export * from "./guards";
export * from "./decorators";
