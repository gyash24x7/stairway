import jwt, { JwtPayload } from "jsonwebtoken";
import type { CookieOptions } from "express";
import type { PrismaClient } from "@prisma/client";

export function signJwt( subject: string, tokenType: "access" | "refresh" ) {
	const expiresIn = tokenType === "access" ? 15 * 60 : 365 * 24 * 60 * 60;
	return jwt.sign( {}, process.env[ "JWT_SECRET" ]!, { expiresIn, subject } );
}

export function verifyJwt( token: string ): { valid: boolean, expired: boolean, subject?: string } {
	try {
		const payload = jwt.verify( token, process.env[ "JWT_SECRET" ]! ) as JwtPayload;
		return { valid: true, expired: false, subject: payload.sub };
	} catch ( e: any ) {
		console.error( e );
		return { valid: false, expired: e.message === "jwt expired" };
	}
}

export async function reIssueAccessToken( refreshToken: string, prisma: PrismaClient ) {
	const { subject } = verifyJwt( refreshToken );

	if ( !subject ) {
		return;
	}

	const user = await prisma.user.findUnique( { where: { salt: subject } } );

	if ( !user ) {
		return;
	}

	return signJwt( user.id, "access" );
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