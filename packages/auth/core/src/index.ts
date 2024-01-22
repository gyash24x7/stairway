import { AuthRepository, createAuthDrizzleClient, PostgresClient } from "@common/data";
import type { Router } from "express";
import { Paths } from "./auth.constants";
import { AuthHandler } from "./auth.handler";
import { AuthMiddleware } from "./auth.middleware";
import { AuthService } from "./auth.service";
import { JwtService } from "./jwt.service";

export function initializeAuthModule( dbClient: PostgresClient, router: Router ) {
	const authDrizzleClient = createAuthDrizzleClient( dbClient );
	const jwtService = new JwtService();
	const authRepository = new AuthRepository( authDrizzleClient );
	const authService = new AuthService( authRepository, jwtService );
	const authHandler = new AuthHandler( authService );
	const authMiddleware = new AuthMiddleware( authService, jwtService );

	router.get(
		Paths.GET_AUTH_USER,
		( req, res, next ) => authMiddleware.use( req, res, next ),
		( req, res ) => authHandler.getAuthUser( req, res )
	);

	router.delete(
		Paths.LOGOUT,
		( req, res, next ) => authMiddleware.use( req, res, next ),
		( req, res ) => authHandler.logout( req, res )
	);

	router.get(
		Paths.AUTH_CALLBACK,
		( req, res ) => authHandler.handleAuthCallback( req, res )
	);

	return { authMiddleware };
}

export type User = {
	id: string;
	name: string;
	email: string;
	avatar: string;
}