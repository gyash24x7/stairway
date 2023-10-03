import type { GameStatus } from "@literature/prisma";
import { SetMetadata } from "@nestjs/common";
import { Constants } from "../constants";

export const RequiresStatus = ( status: GameStatus ) => SetMetadata( Constants.STATUS_KEY, status );