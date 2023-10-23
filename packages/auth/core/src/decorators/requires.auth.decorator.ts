import { UseGuards } from "@nestjs/common";
import { AuthGuard } from "../guards";

export const RequiresAuth = () => UseGuards( AuthGuard );