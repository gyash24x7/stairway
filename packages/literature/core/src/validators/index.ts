import { AddBotsValidator } from "./add.bots.validator";
import { AskCardValidator } from "./ask.card.validator";
import { CallSetValidator } from "./call.set.validator";
import { CreateTeamsValidator } from "./create.teams.validator";
import { JoinGameValidator } from "./join.game.validator";
import { TransferTurnValidator } from "./transfer.turn.validator";

export * from "./add.bots.validator";
export * from "./ask.card.validator";
export * from "./call.set.validator";
export * from "./create.teams.validator";
export * from "./join.game.validator";
export * from "./transfer.turn.validator";

export const validators = [
	AddBotsValidator,
	AskCardValidator,
	CallSetValidator,
	CreateTeamsValidator,
	JoinGameValidator,
	TransferTurnValidator
];