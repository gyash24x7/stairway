import { LoggerFactory, TrpcService } from "@backend/utils";
import { Injectable } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { User } from "./auth.types.ts";
import { CreateUserCommand, LoginCommand, type LoginResponse, VerifyUserCommand } from "./commands";

@Injectable()
export class AuthRouter {

	private readonly logger = LoggerFactory.getLogger( AuthRouter );

	constructor(
		private readonly trpc: TrpcService,
		private readonly commandBus: CommandBus
	) {}

	createContext() {
		return this.trpc.createContextFn;
	}

	router() {
		return this.trpc.router( {
			authInfo: this.trpc.procedure
				.query( ( { ctx } ) => {
					if ( !ctx.authInfo ) {
						this.logger.error( "Unauthorized!" );
						throw new TRPCError( { code: "UNAUTHORIZED" } );
					}

					return ctx.authInfo;
				} ),

			login: this.trpc.procedure
				.input( z.object( { email: z.string(), password: z.string().min( 8 ) } ) )
				.mutation( ( { input } ) => {
					const command = new LoginCommand( input );
					return this.commandBus.execute<LoginCommand, LoginResponse>( command );
				} ),

			createUser: this.trpc.procedure
				.input( z.object( { name: z.string(), email: z.string(), password: z.string().min( 8 ) } ) )
				.mutation( ( { input } ) => {
					const command = new CreateUserCommand( input );
					return this.commandBus.execute<CreateUserCommand, User>( command );
				} ),

			verifyUser: this.trpc.procedure
				.input( z.object( { id: z.string(), code: z.string() } ) )
				.mutation( ( { input } ) => {
					const command = new VerifyUserCommand( input );
					return this.commandBus.execute<VerifyUserCommand, User>( command );
				} )
		} );
	}
}
