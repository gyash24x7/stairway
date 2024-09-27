import { Global, Module } from "@nestjs/common";
import { OgmaModule } from "@ogma/nestjs-module";
import { AuthController } from "./auth.controller.ts";
import { AuthPrisma } from "./auth.prisma.ts";
import { AuthService } from "./auth.service.ts";

@Global()
@Module( {
	imports: [ OgmaModule.forFeatures( [ AuthController, AuthService ] ) ],
	providers: [ AuthService, AuthPrisma ],
	controllers: [ AuthController ],
	exports: [ AuthService ]
} )
export class AuthModule {}