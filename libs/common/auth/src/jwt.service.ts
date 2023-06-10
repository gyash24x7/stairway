import { Injectable } from "@nestjs/common";
import type { Request } from "express";
import { importPKCS8, importSPKI, jwtVerify, SignJWT } from "jose";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { AppConfig, Config, LoggerFactory } from "@s2h/utils";

@Injectable()
export class JwtService {
	public static readonly ALGORITHM = "RS256";
	private readonly logger = LoggerFactory.getLogger( JwtService );

	constructor( @Config() private readonly config: AppConfig ) { }

	async getPrivateKey() {
		const privateKey = await readFile( join( __dirname, this.config.auth.privateKeyPath ), "utf-8" );
		return importPKCS8( privateKey, JwtService.ALGORITHM );
	}

	async getPublicKey() {
		const publicKey = await readFile( join( __dirname, this.config.auth.publicKeyPath ), "utf-8" );
		return importSPKI( publicKey, JwtService.ALGORITHM );
	}

	async sign( payload: { id: string, name: string, verified: boolean; avatar: string; } ) {
		const privateKey = await this.getPrivateKey();

		return new SignJWT( payload )
			.setAudience( this.config.auth.audience )
			.setIssuedAt()
			.setExpirationTime( "1d" )
			.setIssuer( `http://${ this.config.auth.domain }` )
			.setProtectedHeader( { alg: JwtService.ALGORITHM, typ: privateKey.type } )
			.setSubject( payload.id )
			.sign( privateKey );
	}

	async verify( token: string ) {
		const publicKey = await this.getPublicKey();

		const { payload } = await jwtVerify(
			token,
			publicKey,
			{
				audience: this.config.auth.audience,
				issuer: `http://${ this.config.auth.domain }`,
				algorithms: [ JwtService.ALGORITHM ]
			}
		).catch( () => {
			this.logger.error( "Error Verifying Token!" );
			return { payload: null };
		} );

		return payload;
	}

	extractTokenFromRequestHeaders( req: Request ) {
		let token: string | undefined;
		const authHeader = req.headers.authorization;

		if ( authHeader ) {
			const [ scheme, tokenInHeader ] = authHeader.split( " " );
			if ( scheme.toLowerCase() === "bearer" && !!tokenInHeader ) {
				token = tokenInHeader;
			}
		}
		return token;
	}
}
