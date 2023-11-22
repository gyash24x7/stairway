import jwt, { JwtPayload } from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { JwtService } from "../../src/auth/jwt.service";

describe( "JwtService", () => {

	const jwtService = new JwtService();

	it( "should generate access token with 15m expiration", async () => {
		process.env[ "JWT_SECRET" ] = "jwtSecret";
		const token = jwtService.sign( "subject", "access" );
		const payload = jwt.verify( token, "jwtSecret" ) as JwtPayload;

		expect( payload.sub ).toBe( "subject" );
		expect( payload.exp! - payload.iat! ).toBe( 15 * 60 );
	} );

	it( "should generate refresh token with 1y expiration", async () => {
		process.env[ "JWT_SECRET" ] = "jwtSecret";
		const token = jwtService.sign( "subject", "refresh" );
		const payload = jwt.verify( token, "jwtSecret" ) as JwtPayload;

		expect( payload.sub ).toBe( "subject" );
		expect( payload.exp! - payload.iat! ).toBe( 365.25 * 24 * 60 * 60 );
	} );

	it( "should throw error if token expired", async () => {
		process.env[ "JWT_SECRET" ] = "jwtSecret";

		const token = jwt.sign( {}, "jwtSecret", { expiresIn: 0, subject: "subject" } );
		const { subject, expired } = jwtService.verify( token );

		expect( subject ).toBeFalsy();
		expect( expired ).toBeTruthy();
	} );

	it( "should throw error if other error", async () => {
		process.env[ "JWT_SECRET" ] = "jwtSecret";
		const token = jwt.sign( {}, "jwtSecret1", { expiresIn: 15 * 60, subject: "subject" } );

		const { subject, expired } = jwtService.verify( token );

		expect( subject ).toBeFalsy();
		expect( expired ).toBeFalsy();
	} );

	it( "should verify token successfully", async () => {
		process.env[ "JWT_SECRET" ] = "jwtSecret";

		const token = jwt.sign( {}, "jwtSecret", { expiresIn: 15 * 60, subject: "subject" } );
		const { expired, subject } = jwtService.verify( token );

		expect( expired ).toBeFalsy();
		expect( subject ).toBe( "subject" );
	} );

} );
