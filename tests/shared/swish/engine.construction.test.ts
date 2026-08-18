import { describe, expect, test } from "bun:test";
import * as Schema from "effect/Schema";

import { makeEngine } from "@/swish/server/engine.ts";
import { BaseGameConfig } from "@/swish/shared/schema.ts";

import type { GameStructure } from "@/swish/server/structure.ts";

/**
 * `makeEngine` refuses two shapes outright rather than letting them fail later:
 * a game whose name would collide with the engine's own event namespace, and a
 * move named after a command the engine already answers to.
 */

const State = Schema.Struct( { value: Schema.Number } );
const Event = Schema.Union( [ Schema.TaggedStruct( "toy/ev/Bumped", {} ) ] );
const View = Schema.Struct( { value: Schema.Number } );
const Input = Schema.Struct( {} );

type Toy = typeof State.Type;
type ToyEvent = typeof Event.Type;
type ToyView = typeof View.Type;
type ToyConfig = typeof BaseGameConfig.Type;

/**
 * A minimal structure under whatever name and move set a test needs.
 *
 * @param name - The game's name.
 * @param moveNames - The moves it declares.
 * @returns The structure, loosely typed since every test builds a different one.
 */
const structureOf = ( name: string, moveNames: ReadonlyArray<string> ) => {
	const moves = Object.fromEntries(
		moveNames.map( move => [
			move, {
				validate: () => undefined,
				execute: () => []
			}
		] )
	);

	const schemas = Object.fromEntries( moveNames.map( move => [ move, Input ] ) );

	return {
		name,
		schemas: { state: State, config: BaseGameConfig, events: Event, view: View, moves: schemas },
		setup: () => ( { value: 0 } ),
		apply: ( state: Toy ) => state,
		endIf: () => false,
		view: ( { state }: { state: Toy } ) => state,
		hooks: {},
		moves
	} as unknown as GameStructure<
		string,
		Toy,
		ToyConfig,
		Record<string, typeof Input>,
		Record<string, never>,
		ToyEvent,
		ToyView
	>;
};

describe( "the game's name", () => {
	test( "refuses a game named after the engine itself", () => {
		// Engine events are discriminated by the `swish/ev/` prefix, so a game
		// under that name could emit events the reducer would claim as its own.
		expect( () => makeEngine( structureOf( "swish", [ "play" ] ) ) )
			.toThrow( "A game cannot be named \"swish\"" );
	} );

	test( "accepts any other name", () => {
		expect( () => makeEngine( structureOf( "swished", [ "play" ] ) ) ).not.toThrow();
	} );
} );

describe( "move names", () => {
	const reserved = [
		"initialize",
		"join",
		"joinTeam",
		"nameTeam",
		"addBots",
		"start",
		"cleanup",
		"undo",
		"redo",
		"alarm",
		"getState",
		"setAutoPlay"
	];

	for ( const command of reserved ) {
		test( `refuses a move named "${ command }"`, () => {
			expect( () => makeEngine( structureOf( "toy", [ command ] ) ) )
				.toThrow( "Moves may not be named after engine commands" );
		} );
	}

	test( "names every colliding move in the failure", () => {
		expect( () => makeEngine( structureOf( "toy", [ "start", "play", "undo" ] ) ) )
			.toThrow( "start, undo" );
	} );

	test( "accepts a move that only resembles a command", () => {
		expect( () => makeEngine( structureOf( "toy", [ "starting", "rejoin" ] ) ) ).not.toThrow();
	} );
} );
