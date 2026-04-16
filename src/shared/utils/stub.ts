import { CallbreakEngine } from "@/callbreak/core/engine";
import { FishEngine } from "@/fish/core/engine";
import { KingdominoEngine } from "@/kingdomino/core/engine";
import { SplendorEngine } from "@/splendor/core/engine";
import { TicTacToeEngine } from "@/tictactoe/core/engine";
import { WordleEngine } from "@/wordle/core/engine";
import { env } from "cloudflare:workers";

export function getGameStub( game: string, gameId: string ) {
	switch ( game ) {
		case TicTacToeEngine.NAME:
			return getTicTacToeStub( gameId );
		case CallbreakEngine.NAME:
			return getCallbreakStub( gameId );
		case SplendorEngine.NAME:
			return getSplendorStub( gameId );
		case FishEngine.NAME:
			return getFishStub( gameId );
		case KingdominoEngine.NAME:
			return getKingdominoStub( gameId );
		case WordleEngine.NAME:
			return getWordleStub( gameId );
		default:
			throw new Error( `Unknown game: ${ game }` );
	}
}

export function getTicTacToeStub( gameId: string ) {
	return env.TICTACTOE_ENGINE.get( env.TICTACTOE_ENGINE.idFromName( gameId ) );
}

export function getCallbreakStub( gameId: string ) {
	return env.CALLBREAK_ENGINE.get( env.CALLBREAK_ENGINE.idFromName( gameId ) );
}

export function getSplendorStub( gameId: string ) {
	return env.SPLENDOR_ENGINE.get( env.SPLENDOR_ENGINE.idFromName( gameId ) );
}

export function getFishStub( gameId: string ) {
	return env.FISH_ENGINE.get( env.FISH_ENGINE.idFromName( gameId ) );
}

export function getKingdominoStub( gameId: string ) {
	return env.KINGDOMINO_ENGINE.get( env.KINGDOMINO_ENGINE.idFromName( gameId ) );
}

export function getWordleStub( gameId: string ) {
	return env.WORDLE_ENGINE.get( env.WORDLE_ENGINE.idFromName( gameId ) );
}