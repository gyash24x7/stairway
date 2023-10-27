import type { CreateUserInput, UserAuthInfo } from "@auth/types";
import { ConflictException } from "@nestjs/common";
import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler } from "@nestjs/cqrs";
import { LoggerFactory, PrismaService } from "@s2h/core";
import bcrypt from "bcryptjs";
import { Constants, Messages } from "../constants";

export class CreateUserCommand implements ICommand {
	constructor( public readonly input: CreateUserInput ) {}
}

@CommandHandler( CreateUserCommand )
export class CreateUserCommandHandler implements ICommandHandler<CreateUserCommand, UserAuthInfo> {

	private readonly logger = LoggerFactory.getLogger( CreateUserCommandHandler );

	constructor( private readonly prisma: PrismaService ) {}

	async execute( { input }: CreateUserCommand ) {
		this.logger.debug( ">> executeCreateUserCommand()" );

		await this.validate( { input } );

		const salt = await bcrypt.genSalt( 10 );
		const password = await bcrypt.hash( input.password, salt );
		const avatar = Constants.AVATAR_BASE_URL + salt;

		const { salt: s, password: p, ...authInfo } = await this.prisma.user.create( {
			data: { ...input, salt, password, avatar }
		} );

		this.logger.debug( "<< executeCreateUserCommand()" );
		return authInfo;
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