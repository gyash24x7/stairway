import { Ogma } from "@ogma/logger";
import type { Type } from "../utils";
import { LoggerService } from "./logger.service";

export class LoggerFactory {
	private static ogma = new Ogma( { logLevel: "ALL", color: true, json: false } );

	static getLogger( scope?: Type ) {
		return new LoggerService( this.ogma, scope?.name );
	}
}
