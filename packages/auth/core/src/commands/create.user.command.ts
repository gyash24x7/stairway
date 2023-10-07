import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler } from "@nestjs/cqrs";
import type { CreateUserInput } from "@auth/data";
import { Constants } from "../constants";
import bcrypt from "bcryptjs";
import { PrismaService } from "../services";

export class CreateUserCommand implements ICommand {
	constructor( public readonly data: CreateUserInput ) {}
}

@CommandHandler( CreateUserCommand )
export class CreateUserCommandHandler implements ICommandHandler<CreateUserCommand, string> {

	constructor( private readonly prisma: PrismaService ) {}

	async execute( { data }: CreateUserCommand ) {
		const salt = await bcrypt.genSalt( 15 );
		const password = await bcrypt.hash( data.password, salt );
		const avatar = Constants.AVATAR_BASE_URL + salt;

		const user = await this.prisma.user.create( {
			data: { ...data, salt, password, avatar, verified: false }
		} );

		return user.id;
	}

}