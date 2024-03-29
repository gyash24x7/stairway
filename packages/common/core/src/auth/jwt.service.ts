import { LoggerFactory } from "@common/core";
import { Injectable } from "@nestjs/common";
import jwt, { JwtPayload } from "jsonwebtoken";

@Injectable()
export class JwtService {

	private readonly logger = LoggerFactory.getLogger( JwtService );

	sign( subject: string, tokenType: "access" | "refresh" ) {
		const expiresIn = tokenType === "access" ? "15m" : "1y";
		return jwt.sign( {}, process.env[ "JWT_SECRET" ]!, { expiresIn, subject } );
	}

	verify( token: string ) {
		try {
			const payload = jwt.verify( token, process.env[ "JWT_SECRET" ]! ) as JwtPayload;
			return { expired: false, subject: payload.sub };
		} catch ( e: any ) {
			this.logger.error( "Unable to verify token!" );
			return { expired: e.message === "jwt expired" };
		}
	}
}