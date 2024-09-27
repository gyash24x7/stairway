import { AuthService, type UserAuthInfo } from "./auth.service.ts";

export * from "./auth.service.ts";
export * from "./auth.module.ts";

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
