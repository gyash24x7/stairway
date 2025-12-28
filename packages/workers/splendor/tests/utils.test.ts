import { describe, it } from "vitest";
import { generateDecks } from "../src/utils.ts";

describe( "Splendor:Utils", () => {

	describe( "generateDecks()", () => {

		it( "should generate decks correctly", () => {
			generateDecks();
		} );
	} );
} );