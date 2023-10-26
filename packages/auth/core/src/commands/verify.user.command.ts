import type { VerifyUserInput } from "@auth/types";
import { NotFoundException } from "@nestjs/common";
import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler } from "@nestjs/cqrs";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { Messages } from "../constants";

export class VerifyUserCommand implements ICommand {
	constructor( public readonly input: VerifyUserInput ) {}
}

@CommandHandler( VerifyUserCommand )
export class VerifyUserCommandHandler implements ICommandHandler<VerifyUserCommand, string> {

	private readonly logger = LoggerFactory.getLogger( VerifyUserCommandHandler );

	constructor( private readonly prisma: PrismaService ) {}

	async execute( { input }: VerifyUserCommand ) {
		this.logger.debug( ">> executeVerifyUserCommand()" );

		const user = await this.validate( { input } );
		await this.prisma.user.update( { where: { id: user.id }, data: { verified: true } } );

		this.logger.debug( "<< executeVerifyUserCommand()" );
		return user.id;
	}

	private async validate( { input: { id, salt } }: VerifyUserCommand ) {
		this.logger.debug( ">> validateVerifyUserCommand()" );

		const user = await this.prisma.user.findFirst( { where: { id, salt } } );

		if ( !user ) {
			this.logger.error( "%s id: %s, hash: %s", Messages.USER_NOT_FOUND, id, salt );
			throw new NotFoundException( Messages.USER_NOT_FOUND );
		}

		this.logger.debug( "<< validateVerifyUserCommand()" );
		return user;
	}

}