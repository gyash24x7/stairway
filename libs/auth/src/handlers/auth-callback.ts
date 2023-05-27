import { createId } from "@paralleldrive/cuid2";
import { AVATAR_BASE_URL, db, ExpressHandler, logger } from "@s2h/utils";
import * as bcrypt from "bcryptjs";
import { Connection } from "rethinkdb-ts";
import { accessTokenCookieOptions, getGoogleToken, getGoogleUser, refreshTokenCookieOptions, signJwt } from "../utils";

export function handleAuthCallback( connection: Connection ): ExpressHandler {
	return async ( req, res ) => {
		logger.debug( ">> handleAuthCallback()" );

		const code = req.query[ "code" ] as string;
		const { access_token, id_token } = await getGoogleToken( code );
		const { verified_email, email, name } = await getGoogleUser( access_token, id_token );

		if ( !verified_email ) {
			logger.error( "Google account is not verified!" );
			return res.status( 403 ).send( "Google account is not verified" );
		}

		let users = await db.users().filter( { email } ).run( connection );
		let salt: string;
		let id: string;

		if ( users.length === 0 ) {
			logger.debug( "New User Detected!" );
			salt = await bcrypt.genSalt( 10 );
			id = createId();
			const avatar = `${ AVATAR_BASE_URL }/${ id }.svg?r=50`;
			await db.users().insert( { email, name, avatar, salt, id } ).run( connection );
		} else {
			logger.debug( "User Already Exists!" );
			salt = users[ 0 ].salt;
			id = users[ 0 ].id;
		}

		const accessToken = await signJwt( id, "15m" );
		const refreshToken = await signJwt( salt, "1y" );

		res.cookie( "accessToken", accessToken, accessTokenCookieOptions );
		res.cookie( "refreshToken", refreshToken, refreshTokenCookieOptions );

		logger.debug( "User Saved, Cookies Set!" );
		return res.redirect( "http://localhost:3000/literature" );
	};
}