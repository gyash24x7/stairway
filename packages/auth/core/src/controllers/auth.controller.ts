import type { AuthTokenData, CreateUserInput, LoginInput, UserAuthInfo } from "@auth/types";
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Res } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { LoggerFactory } from "@s2h/core";
import type { CookieOptions, Response } from "express";
import { CreateUserCommand, LoginCommand, VerifyUserCommand } from "../commands";
import { Paths } from "../constants";
import { AuthInfo, RequiresAuth } from "../decorators";

const cookieOptions: CookieOptions = {
	maxAge: 9000000,
	httpOnly: true,
	domain: "localhost",
	path: "/",
	sameSite: "lax",
	secure: false
};

@Controller( Paths.BASE )
export class AuthController {

	private readonly logger = LoggerFactory.getLogger( AuthController );

	constructor( private readonly commandBus: CommandBus ) {}

	@Get()
	@RequiresAuth()
	async getAuthInfo( @AuthInfo() authInfo: UserAuthInfo ) {
		this.logger.debug( ">> getUser()" );
		return authInfo;
	}

	@Post( Paths.SIGNUP )
	@HttpCode( HttpStatus.CREATED )
	async createUser( @Body() data: CreateUserInput ) {
		this.logger.debug( ">> createUser()" );
		await this.commandBus.execute( new CreateUserCommand( data ) );
		this.logger.debug( "<< createUser()" );
	}

	@Post( Paths.LOGIN )
	@HttpCode( HttpStatus.OK )
	async login( @Body() data: LoginInput, @Res( { passthrough: true } ) res: Response ) {
		this.logger.debug( ">> login()" );
		const { token, authInfo }: AuthTokenData = await this.commandBus.execute( new LoginCommand( data ) );
		res.cookie( "auth-cookie", token, cookieOptions );
		res.status( HttpStatus.OK );
		this.logger.debug( "<< login()" );
		return authInfo;
	}

	@Get( Paths.VERIFY )
	@HttpCode( HttpStatus.OK )
	async verifyUser( @Query( "hash" ) salt: string, @Query( "id" ) id: string ): Promise<UserAuthInfo> {
		this.logger.debug( ">> verifyUser()" );
		const authInfo = await this.commandBus.execute( new VerifyUserCommand( { salt, id } ) );
		this.logger.debug( "<< verifyUser()" );
		return authInfo;
	}

	@Post( Paths.LOGOUT )
	@RequiresAuth()
	@HttpCode( HttpStatus.NO_CONTENT )
	logout( @Res() res: Response ) {
		this.logger.debug( ">> logout()" );
		res.clearCookie( "auth-cookie", cookieOptions );
		res.status( HttpStatus.NO_CONTENT ).send();
		this.logger.debug( "<< logout()" );
	}
}