import { LoggerFactory } from "@backend/utils";
import { CommandHandler, type ICommand, type ICommandHandler } from "@nestjs/cqrs";
import { TRPCError } from "@trpc/server";
import { AuthRepository } from "../auth.repository.ts";
import type { User } from "../auth.types.ts";

export type VerifyUserInput = {
	id: string;
	code: string;
}

export class VerifyUserCommand implements ICommand {
	constructor( public readonly input: VerifyUserInput ) {}
}

@CommandHandler( VerifyUserCommand )
export class VerifyUserCommandHandler implements ICommandHandler<VerifyUserCommand, User> {

	private readonly logger = LoggerFactory.getLogger( VerifyUserCommandHandler );

	constructor( private readonly repository: AuthRepository ) {}

	async execute( { input }: VerifyUserCommand ) {
		this.logger.debug( ">> executeVerifyUserCommand()" );

		const token = await this.repository.getTokenByIdAndCode( input.id, input.code );
		if ( !token ) {
			this.logger.error( "Verification Token Not Found!" );
			throw new TRPCError( { code: "BAD_REQUEST" } );
		}

		let user = await this.repository.getUser( input.id );
		if ( !user ) {
			this.logger.error( "User with id %s not found!", input.id );
			throw new TRPCError( { code: "BAD_REQUEST" } );
		}

		user = await this.repository.verifyUser( input.id );
		await this.repository.deleteToken( input.id );

		this.logger.debug( "<< executeVerifyUserCommand()" );
		return user;
	}
}