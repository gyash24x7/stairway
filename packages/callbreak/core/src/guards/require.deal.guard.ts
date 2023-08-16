import { BadRequestException, CanActivate, ExecutionContext, Injectable, NotFoundException } from "@nestjs/common";
import { LoggerFactory } from "@s2h/utils";
import type { Response } from "express";
import { CallbreakService } from "../services";
import { CallbreakDeal, CallbreakDealStatus, CallbreakGame } from "@callbreak/data";

@Injectable()
export class RequireDealGuard implements CanActivate {
	private readonly logger = LoggerFactory.getLogger( RequireDealGuard );

	constructor( private readonly callbreakService: CallbreakService ) {}

	async canActivate( context: ExecutionContext ) {
		const res = context.switchToHttp().getResponse<Response>();
		const currentGame: CallbreakGame = res.locals[ "currentGame" ];

		if ( !currentGame ) {
			this.logger.error( "Game Not Present!" );
			throw new NotFoundException();
		}

		const deals = await this.callbreakService.findDealsForGame( currentGame.id );
		const activeDeals = deals.filter( deal => {
			return deal.status === CallbreakDealStatus.CREATED || deal.status === CallbreakDealStatus.IN_PROGRESS;
		} );

		if ( activeDeals.length !== 1 ) {
			this.logger.error( "There are more than 1 active deal for the game! Game: %s", currentGame.id );
			throw new BadRequestException();
		}

		const activeDeal = activeDeals[ 0 ];
		res.locals[ "currentDeal" ] = CallbreakDeal.from( { ...activeDeal, id: activeDeal._id.toHexString() } );
		return !!activeDeal;
	}
}