import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { LoggerFactory } from "@s2h/utils";
import type { Request, Response } from "express";
import { CallbreakService } from "../services";

@Injectable()
export class RequireGameGuard implements CanActivate {
	private readonly logger = LoggerFactory.getLogger( RequireGameGuard );

	constructor( private readonly callbreakService: CallbreakService ) {}

	async canActivate( context: ExecutionContext ) {
		const req = context.switchToHttp().getRequest<Request>();
		const res = context.switchToHttp().getResponse<Response>();
		const gameId: string = req.params[ "id" ];
		this.logger.debug( "GameId: %s", gameId );

		const game = await this.callbreakService.findGameById( gameId );
		res.locals[ "currentGame" ] = game.id;
		return !!game;
	}
}