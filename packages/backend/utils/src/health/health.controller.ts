import { Controller, Get } from "@nestjs/common";
import { LoggerFactory } from "../logger";

@Controller( "health" )
export class HealthController {

	private readonly logger = LoggerFactory.getLogger( HealthController );

	@Get()
	healthCheck() {
		this.logger.log( "Healthy!!" );
		return true;
	}
}