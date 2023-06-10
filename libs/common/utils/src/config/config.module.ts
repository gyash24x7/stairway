import { DynamicModule, Module } from "@nestjs/common";
import { CONFIG_DATA } from "./config.decorator";
import { generateConfig } from "./config.generate";

@Module( {} )
export class ConfigModule {
	static register( app: string ): DynamicModule {
		return {
			module: ConfigModule,
			providers: [ { provide: CONFIG_DATA, useValue: generateConfig( app ) } ],
			exports: [ CONFIG_DATA ]
		};
	}
}