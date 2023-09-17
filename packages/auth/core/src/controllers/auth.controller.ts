import { Body, Controller, Get, Post, Query, Res, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../guards";
import { AuthInfo } from "../decorators";
import type { CookieOptions, Response } from "express";
import type { AuthTokenData, CreateUserInput, LoginInput, UserAuthInfo } from "@auth/data";
import { Paths } from "../constants";
import { CommandBus } from "@nestjs/cqrs";
import { CreateUserCommand, LoginCommand, VerifyUserCommand } from "../commands";

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

	constructor( private readonly commandBus: CommandBus ) {}

	@Get( Paths.ME )
	@UseGuards( AuthGuard )

	getUser( @AuthInfo() authInfo: UserAuthInfo ): UserAuthInfo {
		return authInfo;
	}

	@Post( Paths.SIGNUP )

	async createUser( @Body() data: CreateUserInput ): Promise<string> {
		return this.commandBus.execute( new CreateUserCommand( data ) );
	}

	@Post( Paths.LOGIN )

	async login( @Body() data: LoginInput, @Res() res: Response ) {
		const { token, userId }: AuthTokenData = await this.commandBus.execute( new LoginCommand( data ) );
		res.cookie( "auth-cookie", token, cookieOptions );
		res.status( 200 ).send( userId );
	}

	@Get( Paths.VERIFY )

	async verifyUser( @Query( "hash" ) salt: string, @Query( "id" ) id: string ): Promise<string> {
		return this.commandBus.execute( new VerifyUserCommand( { salt, id } ) );
	}

	@Post( Paths.LOGOUT )
	@UseGuards( AuthGuard )

	logout( @Res() res: Response, @AuthInfo() authInfo: UserAuthInfo ) {
		res.clearCookie( "auth-cookie", cookieOptions );
		res.status( 200 ).send( authInfo.id );
	}
}