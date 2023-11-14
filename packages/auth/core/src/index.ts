import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AuthController } from "./controllers";
import { AuthMiddleware } from "./middlewares";
import { AuthService, JwtService } from "./services";

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

export * from "./guards";
export * from "./decorators";
