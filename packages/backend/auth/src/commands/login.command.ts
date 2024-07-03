import { LoggerFactory, type UserAuthInfo } from "@backend/utils";
import { CommandHandler, type ICommand, type ICommandHandler } from "@nestjs/cqrs";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { sign } from "jsonwebtoken";
import { AuthRepository } from "../auth.repository.ts";

export type LoginInput = {
	email: string;
	password: string;
}

export type LoginResponse = {
	authInfo?: UserAuthInfo;
	authToken: string;
}

export class LoginCommand implements ICommand {
	constructor( public readonly input: LoginInput ) {}
}

@CommandHandler( LoginCommand )
export class LoginCommandHandler implements ICommandHandler<LoginCommand, LoginResponse> {

	private readonly logger = LoggerFactory.getLogger( LoginCommandHandler );

	constructor( private readonly repository: AuthRepository ) {}

	async execute( { input }: LoginCommand ) {
		this.logger.debug( ">> executeLoginCommand()" );

		let user = await this.repository.getUserByEmail( input.email );
		if ( !user ) {
			this.logger.error( "User with email %s not found!", input.email );
			throw new TRPCError( { code: "BAD_REQUEST" } );
		}

		if ( !user.verified ) {
			this.logger.error( "User with email %s is not verified!", input.email );
			throw new TRPCError( { code: "BAD_REQUEST" } );
		}

		const doPasswordsMatch = await bcrypt.compare( input.password, user.password );
		if ( !doPasswordsMatch ) {
			this.logger.error( "Invalid Credentials!" );
			throw new TRPCError( { code: "BAD_REQUEST" } );
		}

		const { email, password, salt, ...authInfo } = user;
		const authToken = sign( authInfo, process.env[ "JWT_SECRET" ]! );

		this.logger.debug( "<< executeLoginCommand()" );
		return { authInfo, authToken };
	}
}