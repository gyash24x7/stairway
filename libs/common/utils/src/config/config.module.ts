import { DynamicModule, Global, Module } from "@nestjs/common";
import { CONFIG_DATA } from "./config.decorator";
import { generateConfig } from "./config.generate";

@Global()
@Module( {} )
export class ConfigModule {
	static register( app: string ): DynamicModule {
		return {
			global: true,
			module: ConfigModule,
			providers: [ { provide: CONFIG_DATA, useValue: generateConfig( app ) } ],
			exports: [ CONFIG_DATA ]
		};
	}
}