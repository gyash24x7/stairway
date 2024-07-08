import { EventsHandler, type IEvent, type IEventHandler } from "@nestjs/cqrs";
import type { User } from "../auth.types.ts";
import { LoggerFactory, MailjetService } from "@backend/utils";
import { AuthRepository } from "../auth.repository.ts";

export class UserCreatedEvent implements IEvent {
	constructor( public readonly user: User ) {}
}

@EventsHandler( UserCreatedEvent )
export class UserCreatedEventHandler implements IEventHandler<UserCreatedEvent> {

	private readonly logger = LoggerFactory.getLogger( UserCreatedEventHandler );

	constructor(
		private readonly repository: AuthRepository,
		private readonly mailjetService: MailjetService
	) {}

	async handle( { user }: UserCreatedEvent ) {
		this.logger.debug( ">> handleUserCreatedEvent()" );

		const token = await this.repository.createToken( user.id );
		const frontendUrl = process.env[ "FRONTEND_URL" ]!
		const verificationLink = `${ frontendUrl }/auth/verify?code=${ token.code }&id=${ token.id }`

		await this.mailjetService.sendEmail( {
			name: user.name,
			email: user.email,
			subject: "Verify Stairway Email Address",
			content: verificationLink
		} )

		this.logger.debug( "<< handleUserCreatedEvent()" );
	}
}