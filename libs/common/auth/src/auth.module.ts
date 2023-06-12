import { Module } from "@nestjs/common";
import { JwtService } from "./jwt.service";
import { ConfigModule, DatabaseModule } from "@s2h/utils";

@Module( {
	imports: [ ConfigModule, DatabaseModule ],
	providers: [ JwtService ],
	exports: [ JwtService ]
} )
export class AuthModule {}
