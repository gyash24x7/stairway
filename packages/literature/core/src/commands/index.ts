import { AskCardCommandHandler } from "./ask.card.command";
import { CallSetCommandHandler } from "./call.set.command";
import { CreateGameCommandHandler } from "./create.game.command";
import { CreateInferencesCommandHandler } from "./create.inferences.command";
import { CreateTeamsCommandHandler } from "./create.teams.command";
import { JoinGameCommandHandler } from "./join.game.command";
import { StartGameCommandHandler } from "./start.game.command";
import { TransferTurnCommandHandler } from "./transfer.turn.command";
import { UpdateHandsCommandHandler } from "./update.hands.command";
import { UpdateInferencesCommandHandler } from "./update.inferences.command";
import { UpdateScoreCommandHandler } from "./update.score.command";
import { UpdateStatusCommandHandler } from "./update.status.command";
import { UpdateTurnCommandHandler } from "./update.turn.command";

export * from "./create.game.command";
export * from "./join.game.command";
export * from "./create.teams.command";
export * from "./start.game.command";
export * from "./ask.card.command";
export * from "./call.set.command";
export * from "./transfer.turn.command";
export * from "./create.inferences.command";
export * from "./update.hands.command";
export * from "./update.inferences.command";
export * from "./update.score.command";
export * from "./update.status.command";
export * from "./update.turn.command";

export const commandHandlers = [
	CreateGameCommandHandler,
	JoinGameCommandHandler,
	CreateTeamsCommandHandler,
	StartGameCommandHandler,
	AskCardCommandHandler,
	CallSetCommandHandler,
	TransferTurnCommandHandler,
	CreateInferencesCommandHandler,
	UpdateHandsCommandHandler,
	UpdateInferencesCommandHandler,
	UpdateScoreCommandHandler,
	UpdateStatusCommandHandler,
	UpdateTurnCommandHandler
];