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

export type BaseGameConfig = { playerCount: number; autoStart?: boolean };

export type ValidateFn<G, C extends BaseGameConfig, I = unknown> = (
	data: ReadonlyGameData<G, C>,
	playerId: PlayerId,
	input: I
) => void;

export type ExecuteFn<G, C extends BaseGameConfig, I = unknown> = (
	data: ReadonlyGameData<G, C>,
	playerId: PlayerId,
	input: I
) => G;

export type Move<G, C extends BaseGameConfig, I = unknown> = {
	validate: ValidateFn<G, C, I>;
	execute: ExecuteFn<G, C, I>;
};

type BaseMoveMap = Record<string, unknown>;
export type MoveMap<G, C extends BaseGameConfig, M extends BaseMoveMap> = {
	[K in keyof M]: Move<G, C, M[K]>;
};

export type MoveType<M extends BaseMoveMap> = keyof M;

export type GetNextPlayerFn<G, C extends BaseGameConfig> = ( data: ReadonlyGameData<G, C> ) => PlayerId;
export type GetNextPlayer<G, C extends BaseGameConfig> = "round-robin" | GetNextPlayerFn<G, C>;

export type BotMoveFn<G, C extends BaseGameConfig, M extends BaseMoveMap> = ( data: ReadonlyGameData<G, C> ) => {
	moveType: keyof M;
	input: M[keyof M]
};

export type GameHooks<G, M extends BaseMoveMap, C extends BaseGameConfig> = {
	onJoin?: ( data: ReadonlyGameData<G, C>, playerId: PlayerId ) => G;
	onStart?: ( data: ReadonlyGameData<G, C> ) => G;
	beforeMove?: ( data: ReadonlyGameData<G, C>, playerId: PlayerId, moveType: keyof M ) => G;
	afterMove?: ( data: ReadonlyGameData<G, C>, playerId: PlayerId, moveType: keyof M ) => G;
	onEnd?: ( data: ReadonlyGameData<G, C> ) => G;
};

export type GameId = string;
export type BaseGameData = { id: GameId; code: string };
export type BasePlayerView = { playerId: PlayerId };

export type GameStatus = "CREATED" | "PLAYERS_READY" | "IN_PROGRESS" | "COMPLETED";

export type ReadonlyGameData<G, C extends BaseGameConfig> = {
	state: G;
	config: Readonly<C>;
	context: Readonly<GameContext>;
}

export type GameData<G, C extends BaseGameConfig> = {
	config: C;
	state: G;
	context: GameContext;
	status: GameStatus;
	players: Record<PlayerId, BasePlayerInfo>;
}

export type GameStructure<
	G,
	M extends BaseMoveMap = {},
	C extends BaseGameConfig = BaseGameConfig,
	V extends BasePlayerView = BasePlayerView & G
> = {
	name: string;
	setup: ( input: C ) => G;
	hooks?: GameHooks<G, M, C>;
	moves: MoveMap<G, C, M>;
	endIf: ( data: ReadonlyGameData<G, C> ) => boolean;
	getNextPlayer: GetNextPlayer<G, C>;
	botMove?: BotMoveFn<V, C, M>;
	playerView: ( data: ReadonlyGameData<G, C>, playerId: PlayerId ) => V;
}

export type GameIdInput = { gameId: GameId };
export type JoinGameInput = { code: string };
