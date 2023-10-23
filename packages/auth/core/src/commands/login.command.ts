import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler } from "@nestjs/cqrs";
import type { AuthTokenData, LoginInput } from "@auth/types";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { JwtService } from "@nestjs/jwt";
import { Messages } from "../constants";

export class LoginCommand implements ICommand {
	constructor( public readonly data: LoginInput ) {}
}

@CommandHandler( LoginCommand )
export class LoginCommandHandler implements ICommandHandler<LoginCommand, AuthTokenData> {

	private readonly logger = LoggerFactory.getLogger( LoginCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly jwtService: JwtService
	) {}

	async execute( { data }: LoginCommand ) {
		this.logger.debug( ">> executeLoginCommand()" );

		const user = await this.prisma.user.findUnique( { where: { email: data.email } } );

		if ( !user ) {
			this.logger.error( "%s Email: %s", Messages.USER_NOT_FOUND, data.email );
			throw new NotFoundException( Messages.USER_NOT_FOUND );
		}

		if ( !user.verified ) {
			this.logger.error( "%s Id: %s", Messages.USER_NOT_VERIFIED, user.id );
			throw new BadRequestException( Messages.USER_NOT_VERIFIED );
		}

		const doPasswordsMatch = await bcrypt.compare( data.password, user.password );
		if ( !doPasswordsMatch ) {
			this.logger.error( "%s Id: %s", Messages.INVALID_CREDENTIALS, user.id );
			throw new BadRequestException( Messages.INVALID_CREDENTIALS );
		}

		const token = await this.jwtService.signAsync( { ...user } );
		this.logger.debug( "<< executeLoginCommand()" );
		return { userId: user.id, token };
	}


}