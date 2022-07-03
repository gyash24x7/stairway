import type { PrismaClient } from "@prisma/client";
import { AVATAR_BASE_URL, ExpressHandler } from "@s2h/utils";
import * as bcrypt from "bcryptjs";
import { accessTokenCookieOptions, refreshTokenCookieOptions, signJwt } from "../utils/token";
import { getGoogleToken, getGoogleUser } from "../utils/oauth";

export default function handleAuthCallback( prisma: PrismaClient ): ExpressHandler {
	return async function ( req, res ) {
		const code = req.query[ "code" ] as string;
		const { access_token, id_token } = await getGoogleToken( code );
		const { verified_email, email, name, id } = await getGoogleUser( access_token, id_token );

		if ( !verified_email ) {
			return res.status( 403 ).send( "Google account is not verified" );
		}

		let user = await prisma.user.findUnique( { where: { email } } );

		if ( !user ) {
			const avatar = `${ AVATAR_BASE_URL }/${ id }.svg?r=50`;
			const salt = await bcrypt.genSalt( 10 );
			user = await prisma.user.create( {
				data: { email, name, avatar, salt }
			} );
		}

		const accessToken = signJwt( user.id, "access" );
		const refreshToken = signJwt( user.salt, "refresh" );

		res.cookie( "accessToken", accessToken, accessTokenCookieOptions );
		res.cookie( "refreshToken", refreshToken, refreshTokenCookieOptions );

		return res.redirect( "http://localhost:3000" );
	};
}