import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler } from "@nestjs/cqrs";
import type { AuthTokenData, LoginInput } from "@auth/data";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { JwtService } from "@nestjs/jwt";

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
		const user = await this.prisma.user.findUnique( { where: { email: data.email } } );

		if ( !user ) {
			this.logger.error( "User Not Found! Email: %s", data.email );
			throw new NotFoundException();
		}

		if ( !user.verified ) {
			this.logger.error( "User Not Verified! Id: %s", user.id );
			throw new BadRequestException();
		}

		const doPasswordsMatch = await bcrypt.compare( data.password, user.password );
		if ( !doPasswordsMatch ) {
			this.logger.error( "Invalid Credentials! Id: %s", user.id );
			throw new BadRequestException();
		}

		const token = await this.jwtService.signAsync( { ...user } );
		return { userId: user.id, token };
	}


}