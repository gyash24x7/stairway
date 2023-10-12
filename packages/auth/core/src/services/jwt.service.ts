import { Injectable } from "@nestjs/common";
import { importPKCS8, importSPKI, JWTPayload, jwtVerify, SignJWT } from "jose";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type AppConfig, Config, LoggerFactory } from "@s2h/core";
import type { User, UserAuthInfo } from "@auth/data";
import { Constants } from "../constants";

export interface AuthPayload extends JWTPayload {
	name: string;
	email: string;
	avatar: string;
	verified: boolean;
}

@Injectable()
export class JwtService {
	public static readonly ALGORITHM = "RS256";
	private readonly logger = LoggerFactory.getLogger( JwtService );

	constructor( @Config() private readonly config: AppConfig ) {}

	async sign( { id, email, verified, avatar, name }: Omit<User, "password" | "salt"> ) {
		const privateKey = await this.getPrivateKey();

		return new SignJWT( { id, name, email, avatar, verified } )
			.setAudience( this.config.auth.audience )
			.setIssuedAt()
			.setExpirationTime( "1d" )
			.setIssuer( `http://${ this.config.auth.domain }` )
			.setProtectedHeader( { alg: JwtService.ALGORITHM, typ: privateKey.type } )
			.setSubject( id )
			.sign( privateKey );
	}

	async verify( token: string ): Promise<UserAuthInfo | null> {
		const publicKey = await this.getPublicKey();

		const result = await jwtVerify(
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

		if ( !result.payload ) {
			return null;
		}

		const { name, avatar, sub, verified, email } = result.payload as AuthPayload;
		return { id: sub!, name, email, verified, avatar };
	}

	private async getPrivateKey() {
		const privateKey = await readFile( join( __dirname, this.config.auth.privateKeyPath ), Constants.UTF_8 );
		return importPKCS8( privateKey, JwtService.ALGORITHM );
	}

	private async getPublicKey() {
		const publicKey = await readFile( join( __dirname, this.config.auth.publicKeyPath ), Constants.UTF_8 );
		return importSPKI( publicKey, JwtService.ALGORITHM );
	}
}
