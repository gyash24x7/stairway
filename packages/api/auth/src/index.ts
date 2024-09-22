import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.ts";
import { AuthService, type UserAuthInfo } from "./auth.service.ts";

export * from "./auth.service.ts";

declare global {
	namespace Express {
		interface Locals {
			authInfo: UserAuthInfo;
		}
	}
}

declare module "lucia" {
	interface Register {
		Lucia: AuthService["lucia"];
		DatabaseUserAttributes: UserAuthInfo;
	}
}

@Module( {
	providers: [ AuthService ],
	controllers: [ AuthController ],
	exports: [ AuthService ]
} )
export class AuthModule {}