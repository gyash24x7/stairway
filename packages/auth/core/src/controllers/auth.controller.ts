import {
	BadRequestException,
	Body,
	Controller,
	Get,
	NotFoundException,
	Post,
	Query,
	Res,
	UseGuards
} from "@nestjs/common";
import { AuthGuard } from "../guards";
import { AuthInfo } from "../decorators";
import type { CookieOptions, Response } from "express";
import { DatabaseClient, Log, LoggerFactory } from "@s2h/utils";
import bcrypt from "bcryptjs";
import { JwtService } from "../services";
import { Collection, ObjectId } from "mongodb";
import type { CreateUserInput, IUser, LoginInput, UserAuthInfo } from "@auth/data";

const cookieOptions: CookieOptions = {
	maxAge: 9000000,
	httpOnly: true,
	domain: "localhost",
	path: "/",
	sameSite: "lax",
	secure: false
};

const AVATAR_BASE_URL = "https://api.dicebear.com/6.x/notionists/svg?radius=50&seed=";

@Controller( "auth" )
export class AuthController {

	private readonly logger = LoggerFactory.getLogger( AuthController );
	private readonly users: Collection<IUser>;

	constructor(
		private readonly jwtService: JwtService,
		readonly client: DatabaseClient
	) {
		this.users = client.db( "auth" ).collection( "users" );
	}

	@Get( "me" )
	@UseGuards( AuthGuard )
	@Log( AuthController )
	getUser( @AuthInfo() authInfo: UserAuthInfo ): UserAuthInfo {
		return authInfo;
	}

	@Post( "signup" )
	@Log( AuthController )
	async createUser( @Body() data: CreateUserInput ): Promise<string> {
		const salt = await bcrypt.genSalt( 15 );
		const password = await bcrypt.hash( data.password, salt );
		const avatar = AVATAR_BASE_URL + salt;
		const { insertedId } = await this.users.insertOne( { ...data, salt, password, avatar, verified: false } );
		return insertedId.toHexString();
	}

	@Post( "login" )
	@Log( AuthController )
	async login( @Body() data: LoginInput, @Res() res: Response ) {
		const user = await this.users.findOne( { email: data.email } );
		if ( !user ) {
			this.logger.error( "User Not Found! Email: %s", data.email );
			throw new NotFoundException();
		}

		if ( !user.verified ) {
			this.logger.error( "User Not Verified! Id: %s", user._id.toHexString() );
			throw new BadRequestException();
		}

		const doPasswordsMatch = await bcrypt.compare( data.password, user.password );
		if ( !doPasswordsMatch ) {
			this.logger.error( "Invalid Credentials! Id: %s", user._id.toHexString() );
			throw new BadRequestException();
		}

		const token = await this.jwtService.sign( { ...user, id: user._id.toHexString() } );

		res.cookie( "auth-cookie", token, cookieOptions );
		res.status( 200 ).send( user._id.toHexString() );
	}

	@Get( "verify" )
	@Log( AuthController )
	async verifyUser( @Query( "hash" ) salt: string, @Query( "id" ) id: string ): Promise<string> {
		const _id = new ObjectId( id );
		const user = await this.users.findOne( { _id, salt } );
		if ( !user ) {
			this.logger.error( "User Not Found! id: %s, hash: %s", id, salt );
			throw new NotFoundException();
		}

		user.verified = true;
		await this.users.updateOne( { _id }, user );
		return id;
	}

	@Post( "logout" )
	@UseGuards( AuthGuard )
	@Log( AuthController )
	logout( @Res() res: Response, @AuthInfo() authInfo: UserAuthInfo ) {
		res.clearCookie( "auth-cookie", cookieOptions );
		res.status( 200 ).send( authInfo.id );
	}
}