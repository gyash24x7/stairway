import { createLogger } from "@/shared/utils/logger";
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

export class LiteratureWorkflow extends WorkflowEntrypoint<Env, Params> {

	private readonly logger = createLogger( "Literature:Workflow" );

	override async run( event: WorkflowEvent<Params>, step: WorkflowStep ) {
		this.logger.debug( "Event: %o", event );

		const message = await step.do( "fetch game message", async () => {
			this.logger.debug( "Fetching message..." );
			return { message: "Hello, world!" };
		} );

		this.logger.debug( "Message fetched: %o", message );

		this.logger.debug( "Going to sleep for 5 seconds..." );
		await step.sleep( "going to sleep", 5000 );
		this.logger.debug( "Woke up after 5 seconds!" );

		this.logger.debug( "Waiting for an event..." );
		const reply = await step.waitForEvent( "awaiting reply", { type: "reply", timeout: 20000 } )
			.catch( error => {
				this.logger.error( "Error waiting for event: %s", error.message );
			} );

		this.logger.debug( "Received reply: %o", reply );
	}

}