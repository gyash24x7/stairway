import type { GameStatus } from "@literature/types";
import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";
import { Constants } from "../constants";
import { GameGuard } from "../guards";

export type RequiresGameData = {
	status?: GameStatus;
	turn?: boolean;
	cards?: boolean;
}

export const RequiresGame = ( data: RequiresGameData = {} ) => {
	return applyDecorators(
		SetMetadata( Constants.REQUIRES_KEY, data ),
		UseGuards( GameGuard )
	);
};