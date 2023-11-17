import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthMiddleware } from "./auth.middleware";
import { AuthService } from "./auth.service";
import { JwtService } from "./jwt.service";

@Module( {
	imports: [],
	controllers: [ AuthController ],
	providers: [ AuthService, JwtService ]
} )
export class AuthModule implements NestModule {
	configure( consumer: MiddlewareConsumer ) {
		consumer.apply( AuthMiddleware ).forRoutes( "*" );
	}
}