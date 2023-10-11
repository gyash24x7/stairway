import { expect, test } from "vitest";
import { generateConfig } from "../../src";

test( "Method::generateConfig should generate config from env variables", async () => {
	const config = generateConfig();
	expect( config.appInfo ).toEqual( { id: "stairway", name: "Stairway", host: "localhost", port: 8000 } );
	expect( config.db.url ).toBeTruthy();
	expect( config.auth.audience ).toBeTruthy();
	expect( config.auth.domain ).toBeTruthy();
} );