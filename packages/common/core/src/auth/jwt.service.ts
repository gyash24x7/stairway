import { Injectable } from "@nestjs/common";
import { LoggerFactory } from "@s2h/core";
import jwt, { JwtPayload } from "jsonwebtoken";

@Injectable()
export class JwtService {

	private readonly logger = LoggerFactory.getLogger( JwtService );

	sign( subject: string, tokenType: "access" | "refresh" ) {
		const expiresIn = tokenType === "access" ? "15m" : "1y";
		return jwt.sign( {}, process.env[ "JWT_SECRET" ]!, { expiresIn, subject } );
	}

	verify( token: string ): { valid: boolean, expired: boolean, subject?: string } {
		try {
			const payload = jwt.verify( token, process.env[ "JWT_SECRET" ]! ) as JwtPayload;
			return { valid: true, expired: false, subject: payload.sub };
		} catch ( e: any ) {
			this.logger.error( "Unable to verify token!" );
			return { valid: false, expired: e.message === "jwt expired" };
		}
	}
}