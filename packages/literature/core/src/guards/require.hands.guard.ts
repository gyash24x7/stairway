import {
	BadRequestException,
	CanActivate,
	ExecutionContext,
	Injectable,
	NotFoundException,
	UnauthorizedException
} from "@nestjs/common";
import { CardHand } from "@s2h/cards";
import { LoggerFactory } from "@s2h/utils";
import type { Response } from "express";
import type { UserAuthInfo } from "@auth/data";
import { LiteratureService } from "../services";
import type { LiteratureGame } from "@literature/data";

@Injectable()
export class RequireHandsGuard implements CanActivate {
	private readonly logger = LoggerFactory.getLogger( RequireHandsGuard );

	constructor( private readonly literatureService: LiteratureService ) {}

	async canActivate( context: ExecutionContext ) {
		this.logger.debug( ">> requireHands()" );
		const res = context.switchToHttp().getResponse<Response>();
		const currentGame: LiteratureGame = res.locals[ "currentGame" ];
		const authInfo: UserAuthInfo | null = res.locals[ "currentGame" ];

		if ( !authInfo ) {
			this.logger.error( "User Not Logged In!" );
			throw new UnauthorizedException();
		}

		if ( !currentGame ) {
			this.logger.error( "Game Not Present!" );
			throw new NotFoundException();
		}

		const hands = await this.literatureService.findHandsForGame( currentGame.id );
		const currentGameHands: Record<string, CardHand> = {};

		let handCount = 0;
		for ( const hand of hands ) {
			currentGameHands[ hand.playerId ] = CardHand.from( hand.hand );
			handCount++;
		}

		if ( handCount !== 6 ) {
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error( "Hands Not Present! GameId: %s", currentGame.id );
			throw new BadRequestException();
		}

		res.locals[ "currentGameHands" ] = currentGameHands;
		return true;
	}


}