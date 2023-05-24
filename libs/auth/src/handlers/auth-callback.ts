import { AVATAR_BASE_URL, ExpressHandler, UsersR } from "@s2h/utils";
import * as bcrypt from "bcryptjs";
import { getGoogleToken, getGoogleUser } from "../utils/oauth";
import { accessTokenCookieOptions, refreshTokenCookieOptions, signJwt } from "../utils/token";
import { Connection } from "rethinkdb-ts";
import { createId } from "@paralleldrive/cuid2";

export function handleAuthCallback( r: UsersR, connection: Connection ): ExpressHandler {
	return async function ( req, res ) {
		const code = req.query[ "code" ] as string;
		const { access_token, id_token } = await getGoogleToken( code );
		const { verified_email, email, name } = await getGoogleUser( access_token, id_token );

		if ( !verified_email ) {
			return res.status( 403 ).send( "Google account is not verified" );
		}

		let users = await r.users().filter( { email } ).run( connection );
		let salt: string;
		let id: string;

		if ( users.length === 0 ) {
			salt = await bcrypt.genSalt( 10 );
			id = createId();
			const avatar = `${ AVATAR_BASE_URL }/${ id }.svg?r=50`;
			await r.users().insert( { email, name, avatar, salt, id } ).run( connection );
		} else {
			salt = users[ 0 ].salt;
			id = users[ 0 ].id;
		}

		const accessToken = await signJwt( id, "15m" );
		const refreshToken = await signJwt( salt, "1y" );

		res.cookie( "accessToken", accessToken, accessTokenCookieOptions );
		res.cookie( "refreshToken", refreshToken, refreshTokenCookieOptions );

		return res.redirect( "http://localhost:3000/literature" );
	};
}