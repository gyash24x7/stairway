import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler } from "@nestjs/cqrs";
import type { VerifyUserInput } from "@auth/data";
import { UserService } from "../services";
import { NotFoundException } from "@nestjs/common";
import { LoggerFactory } from "@s2h/core";

export class VerifyUserCommand implements ICommand {
	constructor( public readonly data: VerifyUserInput ) {}
}

@CommandHandler( VerifyUserCommand )
export class VerifyUserCommandHandler implements ICommandHandler<VerifyUserCommand, string> {

	private readonly logger = LoggerFactory.getLogger( VerifyUserCommandHandler );

	constructor( private readonly userService: UserService ) {}


	async execute( { data: { id, salt } }: VerifyUserCommand ) {
		const user = await this.userService.findUserByIdAndSalt( id, salt );

		if ( !user ) {
			this.logger.error( "User Not Found! id: %s, hash: %s", id, salt );
			throw new NotFoundException();
		}

		user.verified = true;
		await this.userService.saveUser( user );
		return id;
	}


}