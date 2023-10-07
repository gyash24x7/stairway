import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler } from "@nestjs/cqrs";
import type { VerifyUserInput } from "@auth/data";
import { NotFoundException } from "@nestjs/common";
import { LoggerFactory } from "@s2h/core";
import { PrismaService } from "../services";

export class VerifyUserCommand implements ICommand {
	constructor( public readonly data: VerifyUserInput ) {}
}

@CommandHandler( VerifyUserCommand )
export class VerifyUserCommandHandler implements ICommandHandler<VerifyUserCommand, string> {

	private readonly logger = LoggerFactory.getLogger( VerifyUserCommandHandler );

	constructor( private readonly prisma: PrismaService ) {}

	async execute( { data: { id, salt } }: VerifyUserCommand ) {
		const user = await this.prisma.user.findFirst( { where: { id, salt } } );

		if ( !user ) {
			this.logger.error( "User Not Found! id: %s, hash: %s", id, salt );
			throw new NotFoundException();
		}

		await this.prisma.user.update( { where: { id }, data: { verified: true } } );
		return id;
	}

}