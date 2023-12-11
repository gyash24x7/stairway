import { HttpException, LoggerFactory } from "@common/core";
import type { AuthRepository } from "@common/data";
import process from "process";
import superagent from "superagent";
import { URL } from "url";
import { Constants, Messages, TokenType } from "./auth.constants";
import type { JwtService } from "./jwt.service";

type GoogleTokenResult = {
	access_token: string;
	expires_in: number;
	refresh_token: string;
	scope: string;
	id_token: string;
}

type GoogleUserResult = {
	id: string;
	email: string;
	verified_email: boolean;
	name: string;
	given_name: string;
	family_name: string;
	picture: string;
	locale: string;
}

export class AuthService {

	private readonly logger = LoggerFactory.getLogger( AuthService );

	constructor(
		private readonly repository: AuthRepository,
		private readonly jwtService: JwtService
	) {}

	async getAuthUser( userId: string ) {
		this.logger.debug( ">> getAuthUser()" );
		const user = await this.repository.getUserById( userId );
		this.logger.debug( "<< getAuthUser()" );
		return user;
	}

	async handleAuthCallback( code: string ) {
		this.logger.debug( ">> handleAuthCallback()" );

		const { access_token, id_token } = await this.getGoogleToken( code );
		const { verified_email, email, name } = await this.getGoogleUser( access_token, id_token );

		if ( !verified_email ) {
			this.logger.warn( "Email Not Verified!" );
			throw new HttpException( 403, Messages.EMAIL_NOT_VERIFIED );
		}

		let user = await this.repository.getUserByEmail( email );

		if ( !user ) {
			this.logger.debug( "New User!" );
			user = await this.repository.createUser( { name, email } );
		}

		const accessToken = this.jwtService.sign( user.id, TokenType.ACCESS_TOKEN );
		const refreshToken = this.jwtService.sign( user.id, TokenType.REFRESH_TOKEN );

		this.logger.debug( "<< handleAuthCallback()" );
		return { accessToken, refreshToken };
	}

	async reIssueAccessToken( refreshToken: string ) {
		this.logger.debug( ">> reIssueAccessToken()" );
		const { subject } = this.jwtService.verify( refreshToken );

		if ( !subject ) {
			return;
		}

		const user = await this.repository.getUserById( subject );

		if ( !user ) {
			return;
		}

		return this.jwtService.sign( subject, TokenType.ACCESS_TOKEN );
	}

	async getGoogleToken( code: string ) {
		this.logger.debug( ">> getGoogleToken()" );

		const url = new URL( Constants.GOOGLE_TOKEN_URL );
		url.searchParams.append( "code", code );
		url.searchParams.append( "client_id", process.env[ "GOOGLE_CLIENT_ID" ]! );
		url.searchParams.append( "client_secret", process.env[ "GOOGLE_CLIENT_SECRET" ]! );
		url.searchParams.append( "redirect_uri", process.env[ "GOOGLE_REDIRECT_URI" ]! );
		url.searchParams.append( "grant_type", "authorization_code" );

		const response: GoogleTokenResult = await superagent
			.post( url.toString() )
			.set( "Content-Type", "application/x-www-form-urlencoded" )
			.then( res => res.body );

		this.logger.debug( "<< getGoogleToken()" );
		return response;
	}

	async getGoogleUser( access_token: string, id_token: string ) {
		this.logger.debug( ">> getGoogleUser()" );

		const url = new URL( Constants.GOOGLE_GET_USER_URL );
		url.searchParams.append( "alt", "json" );
		url.searchParams.append( "access_token", access_token );

		const response: GoogleUserResult = await superagent
			.get( url.toString() )
			.set( "Authorization", `Bearer ${ id_token }` )
			.then( res => res.body );

		this.logger.debug( "<< getGoogleUser()" );
		return response;
	}
}
