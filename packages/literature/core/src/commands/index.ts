import { CreateGameCommandHandler } from "./create.game.command";
import { JoinGameCommandHandler } from "./join.game.command";
import { CreateTeamsCommandHandler } from "./create.teams.command";
import { StartGameCommandHandler } from "./start.game.command";
import { AskCardCommandHandler } from "./ask.card.command";
import { CallSetCommandHandler } from "./call.set.command";
import { TransferChanceCommandHandler } from "./transfer.chance.command";

export * from "./create.game.command";
export * from "./join.game.command";
export * from "./create.teams.command";
export * from "./start.game.command";
export * from "./ask.card.command";
export * from "./call.set.command";
export * from "./transfer.chance.command";

export const commandHandlers = [
	CreateGameCommandHandler,
	JoinGameCommandHandler,
	CreateTeamsCommandHandler,
	StartGameCommandHandler,
	AskCardCommandHandler,
	CallSetCommandHandler,
	TransferChanceCommandHandler
];