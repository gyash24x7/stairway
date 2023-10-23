import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler } from "@nestjs/cqrs";
import type { CreateUserInput } from "@auth/types";
import { Constants, Messages } from "../constants";
import bcrypt from "bcryptjs";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { ConflictException } from "@nestjs/common";

export class CreateUserCommand implements ICommand {
	constructor( public readonly input: CreateUserInput ) {}
}

@CommandHandler( CreateUserCommand )
export class CreateUserCommandHandler implements ICommandHandler<CreateUserCommand, string> {

	private readonly logger = LoggerFactory.getLogger( CreateUserCommandHandler );

	constructor( private readonly prisma: PrismaService ) {}

	async execute( { input }: CreateUserCommand ) {
		this.logger.debug( ">> executeCreateUserCommand()" );

		await this.validate( { input } );

		const salt = await bcrypt.genSalt( 10 );
		const password = await bcrypt.hash( input.password, salt );
		const avatar = Constants.AVATAR_BASE_URL + salt;

		const user = await this.prisma.user.create( {
			data: { ...input, salt, password, avatar }
		} );

		this.logger.debug( "<< executeCreateUserCommand()" );
		return user.id;
	}

	private async validate( { input }: CreateUserCommand ) {
		this.logger.debug( ">> validateCreateUserCommand()" );

		const user = await this.prisma.user.findUnique( {
			where: { email: input.email }
		} );

		if ( !!user ) {
			this.logger.error( "%s Email: %s", Messages.USER_ALREADY_EXISTS, input.email );
			throw new ConflictException( Messages.USER_ALREADY_EXISTS );
		}
	}

}