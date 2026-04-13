export type PlayerId = string;
export type BasePlayerInfo = {
	id: PlayerId;
	name: string;
	avatar: string;
	isBot?: boolean;
}

export type GameContext = {
	turn: number;
	players: PlayerId[];
	currentPlayer: PlayerId;
}

export type BaseGameConfig = { playerCount: number };

export type GameState<G> = { data: G; ctx: GameContext; }

export type ValidateFn<G, C extends BaseGameConfig, I = unknown> = (
	state: GameState<G>,
	config: C,
	playerId: PlayerId,
	input: I
) => void;

export type ExecuteFn<G, C extends BaseGameConfig, I = unknown> = (
	state: GameState<G>,
	config: C,
	playerId: PlayerId,
	input: I
) => G;

export type Move<G, C extends BaseGameConfig, I = unknown> = {
	validate: ValidateFn<G, C, I>;
	execute: ExecuteFn<G, C, I>;
};

export type MoveMap<G, C extends BaseGameConfig, M extends Record<string, unknown>> = {
	[K in keyof M]: Move<G, C, M[K]>;
};

export type MoveType<M extends Record<string, unknown>> = keyof M;

export type GetNextPlayerFn<G> = ( state: GameState<G> ) => PlayerId;
export type GetNextPlayer<G> = "round-robin" | GetNextPlayerFn<G>;

export type BotMoveFn<G, C, M extends Record<string, unknown>> = ( state: GameState<G>, config: C ) => {
	moveType: keyof M;
	input: M[keyof M]
};

export type GameConfig<G, M extends Record<string, unknown> = {}, C extends BaseGameConfig = BaseGameConfig, V = G> = {
	name: string;
	setup: ( input: C ) => G;
	onJoin?: ( state: GameState<G>, config: C, playerId: PlayerId ) => G;
	onStart?: ( state: GameState<G>, config: C ) => G;
	moves: MoveMap<G, C, M>;
	afterMove?: ( state: GameState<G>, config: C ) => G | undefined;
	endIf: ( state: GameState<G>, config: C ) => EndResult | undefined;
	getNextPlayer: GetNextPlayer<G>;
	botMove?: BotMoveFn<V, C, M>;
	playerView: ( data: G, config: C, playerId: PlayerId ) => V;
}

export type MatchId = string;

export type EndResult =
	| { victory: true; winner: PlayerId }
	| { victory: false };

export type MatchStatus = "CREATED" | "PLAYERS_READY" | "IN_PROGRESS" | "COMPLETED";

export type Match<G, C extends BaseGameConfig> = {
	id: MatchId;
	code: string;
	config: C;
	players: Record<PlayerId, BasePlayerInfo>;
	state: GameState<G>;
	status: MatchStatus;
	result?: EndResult;
}

export type MatchData = {
	id: string;
	game: string;
	code: string;
	config: string;
	state: string;
	status: MatchStatus;
	result: string | null;
	createdAt: string;
	players: MatchPlayerData[];
};

export type MatchPlayerData = {
	isBot: 0 | 1;
	name: string;
	avatar: string;
	matchId: string;
	playerId: string;
}

export type MatchIdInput = { matchId: MatchId };
export type JoinMatchInput = { code: string };
