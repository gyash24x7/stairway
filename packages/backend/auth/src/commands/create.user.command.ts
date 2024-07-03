import { LoggerFactory } from "@backend/utils";
import { CommandHandler, type ICommand, type ICommandHandler } from "@nestjs/cqrs";
import { TRPCError } from "@trpc/server";
import { AuthRepository } from "../auth.repository.ts";
import type { User } from "../auth.types.ts";

export type CreateUserInput = {
	name: string;
	email: string;
	password: string;
}

export class CreateUserCommand implements ICommand {
	constructor( public readonly input: CreateUserInput ) {}
}

@CommandHandler( CreateUserCommand )
export class CreateUserCommandHandler implements ICommandHandler<CreateUserCommand, User> {

	private readonly logger = LoggerFactory.getLogger( CreateUserCommandHandler );

	constructor( private readonly repository: AuthRepository ) {}

	async execute( { input }: CreateUserCommand ) {
		this.logger.debug( ">> executeCreateUserCommand()" );
		this.logger.debug( "DB_URL: %s", process.env[ "DATABASE_URL" ] );

		const existingUser = await this.repository.getUserByEmail( input.email ).catch( err => {
			this.logger.error( "Error: %s", err.message );
		} );
		if ( existingUser ) {
			this.logger.error( "User with email %s already exists!", input.email );
			throw new TRPCError( { code: "CONFLICT", message: "User already exists!" } );
		}

		const newUser = await this.repository.createUser( input );

		this.logger.debug( "<< executeCreateUserCommand()" );
		return newUser;
	}
}