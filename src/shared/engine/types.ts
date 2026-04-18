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
	phase?: string;
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

export type CanMoveFn<G, C extends BaseGameConfig> = (
	data: ReadonlyGameData<G, C>,
	playerId: PlayerId
) => boolean;

export type Move<G, C extends BaseGameConfig, I = unknown> = {
	canMove?: CanMoveFn<G, C>;
	validate: ValidateFn<G, C, I>;
	execute: ExecuteFn<G, C, I>;
};

type BaseMoveMap = Record<string, unknown>;
export type MoveMap<G, C extends BaseGameConfig, M extends BaseMoveMap> = {
	[K in keyof M]: Move<G, C, M[K]>;
};

export type MoveType<M extends BaseMoveMap> = keyof M;

export type ResolveNextPlayerFn<G, M extends BaseMoveMap, C extends BaseGameConfig> = (
	data: ReadonlyGameData<G, C>,
	playerId: PlayerId,
	moveType: MoveType<M>
) => PlayerId;

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

export type GamePhase<G, M extends BaseMoveMap, C extends BaseGameConfig> = {
	moves: MoveMap<G, C, M>;
	resolveNextPlayer: ResolveNextPlayerFn<G, M, C>;
	endIf: ( data: ReadonlyGameData<G, C> ) => boolean;
	resolveNextPhase: ( data: ReadonlyGameData<G, C> ) => string;
	onEnter?: ( data: ReadonlyGameData<G, C> ) => G;
	onExit?: ( data: ReadonlyGameData<G, C> ) => G;
	resolveStartingPlayer?: ( data: ReadonlyGameData<G, C> ) => PlayerId;
	botMove?: BotMoveFn<any, C, M>;
	hooks?: Pick<GameHooks<G, M, C>, "beforeMove" | "afterMove">;
};

export type GamePhases<G, C extends BaseGameConfig> = Record<string, GamePhase<G, any, C>>;

type BaseGameStructure<
	G,
	M extends BaseMoveMap,
	C extends BaseGameConfig,
	V extends BasePlayerView
> = {
	name: string;
	setup: ( input: C ) => G;
	hooks?: GameHooks<G, M, C>;
	endIf: ( data: ReadonlyGameData<G, C> ) => boolean;
	playerView: ( data: ReadonlyGameData<G, C>, playerId: PlayerId ) => V;
};

export type PhasedGameStructure<G, C extends BaseGameConfig = BaseGameConfig> = {
	phases: GamePhases<G, C>;
	initialPhase: string;
	moves?: undefined;
	resolveNextPlayer?: undefined;
	botMove?: undefined;
}

export type FlatGameStructure<
	G,
	M extends BaseMoveMap = {},
	C extends BaseGameConfig = BaseGameConfig,
	V extends BasePlayerView = BasePlayerView & G
> = {
	phases?: undefined;
	moves: MoveMap<G, C, M>;
	resolveNextPlayer: ResolveNextPlayerFn<G, M, C>;
	botMove?: BotMoveFn<V, C, M>;
};

export type GameStructure<
	G,
	M extends BaseMoveMap = {},
	C extends BaseGameConfig = BaseGameConfig,
	V extends BasePlayerView = BasePlayerView & G
> = BaseGameStructure<G, M, C, V> & ( FlatGameStructure<G, M, C, V> | PhasedGameStructure<G, C> );

export type GameIdInput = { gameId: GameId };
export type JoinGameInput = { code: string };
