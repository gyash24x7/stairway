import { LoggerFactory } from "./logger.factory";
import type { Type } from "@nestjs/common";

export function Log( scope?: Type ) {
	const logger = LoggerFactory.getLogger( scope );
	return function ( _target: any, propertyKey: string, descriptor: PropertyDescriptor ) {
		const targetMethod = descriptor.value;

		descriptor.value = function ( ...args: any[] ) {
			logger.debug( `>> ${ propertyKey }()` );
			const result = targetMethod.apply( this, args );
			logger.debug( `<< ${ propertyKey }()` );
			return result;
		};
	};
}