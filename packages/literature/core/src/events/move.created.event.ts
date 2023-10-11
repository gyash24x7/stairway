import type { IEvent, IEventHandler } from "@nestjs/cqrs";
import { EventsHandler } from "@nestjs/cqrs";
import type { Move } from "@literature/data";
import { LoggerFactory } from "@s2h/core";

export class MoveCreatedEvent implements IEvent {
	constructor( public readonly move: Move ) {}
}

@EventsHandler( MoveCreatedEvent )
export class MoveCreatedEventHandler implements IEventHandler<MoveCreatedEvent> {

	private readonly logger = LoggerFactory.getLogger( MoveCreatedEventHandler );

	handle( { move }: MoveCreatedEvent ) {
		this.logger.debug( ">> handle()" );
		this.logger.debug( "New Move: %o", move );
	}
}