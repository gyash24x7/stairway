import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import type { User } from "@/auth/schema";
import type { ChatRole } from "@/chat/schema";
import { CallbreakEngine } from "@/games/callbreak/server/engine";
import { CoupEngine } from "@/games/coup/server/engine";
import { FishEngine } from "@/games/fish/server/engine";
import { KingdominoEngine } from "@/games/kingdomino/server/engine";
import { SplendorEngine } from "@/games/splendor/server/engine";
import { TicTacToeEngine } from "@/games/tictactoe/server/engine";
import { WordleEngine } from "@/games/wordle/server/engine";
import type { GameName } from "@/shared/games";
import type { GameRef, Membership, SwishUser } from "@/swish/schema";
import { GameId } from "@/swish/schema";


type Ask = ( ref: GameRef ) => ( user: SwishUser ) => Effect.Effect<Membership, unknown>;

/**
 * Who somebody is to one table, as far as its chat is concerned.
 *
 * Asked of the game's own entity through the engine's `membership` read, so
 * the answer is the game's: a seat is a seat because the game folded a
 * `PlayerJoined` for it, and nothing here keeps a second copy that could
 * disagree. `undefined` covers everybody the chat turns away — a stranger, a
 * game that does not exist, and one that has expired out of the hot store.
 */
export class ChatAccess extends Context.Service<ChatAccess, {
	readonly resolve: (
		game: GameName,
		gameId: string,
		user: User
	) => Effect.Effect<ChatRole | undefined>;
}>()( "chat/ChatAccess" ) {}

export const ChatAccessLive = Layer.effect(
	ChatAccess,
	Effect.gen( function* () {
		// A `Record` keyed by `GameName`, so a game added to the registry without
		// a line here fails to typecheck rather than shutting its tables' chat.
		const engines: Record<GameName, Ask> = {
			callbreak: ( yield* CallbreakEngine ).membership,
			coup: ( yield* CoupEngine ).membership,
			fish: ( yield* FishEngine ).membership,
			kingdomino: ( yield* KingdominoEngine ).membership,
			splendor: ( yield* SplendorEngine ).membership,
			tictactoe: ( yield* TicTacToeEngine ).membership,
			wordle: ( yield* WordleEngine ).membership
		};

		const resolve = ( game: GameName, gameId: string, user: User ) => {
			const ref = { gameId: GameId.make( gameId ) };
			return engines[ game ]( ref )( { id: user.id, name: user.name, avatar: user.avatar } ).pipe(
				Effect.map( ( { role } ) => role === "none" ? undefined : role ),
				Effect.catch( () => Effect.succeed( undefined ) )
			);
		};

		return ChatAccess.of( { resolve } );
	} )
);
