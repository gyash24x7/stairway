import { AddBotsCommandHandler } from "./add.bots.command";
import { AskCardCommandHandler } from "./ask.card.command";
import { CallSetCommandHandler } from "./call.set.command";
import { CreateGameCommandHandler } from "./create.game.command";
import { CreateInferenceCommandHandler } from "./create.inference.command";
import { CreateTeamsCommandHandler } from "./create.teams.command";
import { JoinGameCommandHandler } from "./join.game.command";
import { StartGameCommandHandler } from "./start.game.command";
import { TransferTurnCommandHandler } from "./transfer.turn.command";
import { UpdateHandsCommandHandler } from "./update.hands.command";
import { UpdateInferenceCommandHandler } from "./update.inference.command";
import { UpdateScoreCommandHandler } from "./update.score.command";
import { UpdateStatusCommandHandler } from "./update.status.command";
import { UpdateTurnCommandHandler } from "./update.turn.command";

export * from "./create.game.command";
export * from "./join.game.command";
export * from "./add.bots.command";
export * from "./create.teams.command";
export * from "./start.game.command";
export * from "./ask.card.command";
export * from "./call.set.command";
export * from "./transfer.turn.command";
export * from "./create.inference.command";
export * from "./update.hands.command";
export * from "./update.inference.command";
export * from "./update.score.command";
export * from "./update.status.command";
export * from "./update.turn.command";

export const commandHandlers = [
	CreateGameCommandHandler,
	JoinGameCommandHandler,
	AddBotsCommandHandler,
	CreateTeamsCommandHandler,
	StartGameCommandHandler,
	AskCardCommandHandler,
	CallSetCommandHandler,
	TransferTurnCommandHandler,
	CreateInferenceCommandHandler,
	UpdateHandsCommandHandler,
	UpdateInferenceCommandHandler,
	UpdateScoreCommandHandler,
	UpdateStatusCommandHandler,
	UpdateTurnCommandHandler
];