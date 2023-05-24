import type { CookieOptions } from "express";
import { jwtVerify, SignJWT } from "jose";
import * as process from "process";
import { Connection } from "rethinkdb-ts";
import { UsersR } from "@s2h/utils";

export async function signJwt( subject: string, expiresIn: string ): Promise<string> {
	const secret = new TextEncoder().encode( process.env[ "JWT_SECRET" ] || "" );
	return new SignJWT( {} )
		.setProtectedHeader( { alg: "HS256" } )
		.setIssuedAt()
		.setAudience( "stairway:api" )
		.setExpirationTime( expiresIn )
		.setSubject( subject )
		.sign( secret );
}

export async function verifyJwt( token: string ): Promise<{ valid: boolean, expired: boolean, subject?: string }> {
	try {
		const secret = new TextEncoder().encode( process.env[ "JWT_SECRET" ] || "" );
		const { payload } = await jwtVerify( token, secret );
		return { valid: true, expired: false, subject: payload.sub };
	} catch ( e: any ) {
		return { valid: false, expired: e.code === "ERR_JWT_EXPIRED" };
	}
}

export async function reIssueAccessToken( refreshToken: string, r: UsersR, connection: Connection ) {
	const { subject } = await verifyJwt( refreshToken );

	if ( !subject ) {
		return;
	}

	const users = await r.users().filter( { salt: subject } ).run( connection );
	if ( users.length === 0 ) {
		return;
	}

	return signJwt( users[ 0 ].id, "15m" );
}

export const accessTokenCookieOptions: CookieOptions = {
	maxAge: 9000000,
	httpOnly: true,
	domain: "localhost",
	path: "/",
	sameSite: "lax",
	secure: false
};

export const refreshTokenCookieOptions: CookieOptions = {
	...accessTokenCookieOptions,
	maxAge: 3.154e10 // 1 year
};