import { Body, Controller, Get, Post, Query, Res } from "@nestjs/common";
import { AuthInfo, RequiresAuth } from "../decorators";
import type { CookieOptions, Response } from "express";
import type { AuthTokenData, CreateUserInput, LoginInput, UserAuthInfo } from "@auth/types";
import { Paths } from "../constants";
import { CommandBus } from "@nestjs/cqrs";
import { CreateUserCommand, LoginCommand, VerifyUserCommand } from "../commands";
import type { ApiResponse } from "@s2h/client";
import { LoggerFactory } from "@s2h/core";

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
	getUser( @AuthInfo() authInfo: UserAuthInfo ): UserAuthInfo {
		this.logger.debug( ">> getUser()" );
		return authInfo;
	}

	@Post( Paths.SIGNUP )
	async createUser( @Body() data: CreateUserInput ): Promise<ApiResponse> {
		this.logger.debug( ">> createUser()" );
		await this.commandBus.execute( new CreateUserCommand( data ) );
		this.logger.debug( "<< createUser()" );
		return { success: true };
	}

	@Post( Paths.LOGIN )
	async login( @Body() data: LoginInput, @Res() res: Response ) {
		this.logger.debug( ">> login()" );
		const { token }: AuthTokenData = await this.commandBus.execute( new LoginCommand( data ) );
		res.cookie( "auth-cookie", token, cookieOptions );
		res.status( 200 ).json( { success: true } );
		this.logger.debug( "<< login()" );
	}

	@Get( Paths.VERIFY )
	async verifyUser( @Query( "hash" ) salt: string, @Query( "id" ) id: string ): Promise<ApiResponse> {
		this.logger.debug( ">> verifyUser()" );
		await this.commandBus.execute( new VerifyUserCommand( { salt, id } ) );
		this.logger.debug( "<< verifyUser()" );
		return { success: true };
	}

	@Post( Paths.LOGOUT )
	@RequiresAuth()
	logout( @Res() res: Response, @AuthInfo() authInfo: UserAuthInfo ) {
		this.logger.debug( ">> logout()" );
		res.clearCookie( "auth-cookie", cookieOptions );
		res.status( 200 ).send( authInfo.id );
		this.logger.debug( "<< logout()" );
	}
}