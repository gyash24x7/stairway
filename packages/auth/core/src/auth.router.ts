import { ApiRouter } from "@s2h/core";
import { Paths } from "./auth.constants";
import type { AuthHandler } from "./auth.handler";
import { authHandler } from "./auth.handler";
import type { AuthMiddleware } from "./auth.middleware";
import { authMiddleware } from "./auth.middleware";

export class AuthRouter extends ApiRouter {

	constructor(
		private readonly authMiddleware: AuthMiddleware,
		private readonly authHandler: AuthHandler
	) {
		super();
	}

	registerRoutes() {
		this.router.get(
			Paths.GET_AUTH_USER,
			( req, res, next ) => this.authMiddleware.use( req, res, next ),
			( req, res ) => this.authHandler.getAuthUser( req, res )
		);

		this.router.delete(
			Paths.LOGOUT,
			( req, res, next ) => this.authMiddleware.use( req, res, next ),
			( req, res ) => this.authHandler.logout( req, res )
		);

		this.router.get(
			Paths.AUTH_CALLBACK,
			( req, res ) => this.authHandler.handleAuthCallback( req, res )
		);

		return this.router;
	}
}

export const authRouter = new AuthRouter( authMiddleware, authHandler );