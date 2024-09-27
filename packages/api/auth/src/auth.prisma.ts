import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";

@Injectable()
export class AuthPrisma {

	constructor(
		@Inject( "PRISMA_CLIENT" )
		private readonly prisma: PrismaClient
	) {}

	get user() {
		return this.prisma.user;
	}

	get session() {
		return this.prisma.session;
	}
}