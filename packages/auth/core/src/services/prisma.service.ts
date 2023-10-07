import { Injectable } from "@nestjs/common";
import { BasePrismaService } from "@s2h/core";

@Injectable()
export class PrismaService {

	constructor( private readonly prisma: BasePrismaService ) {}

	get user() {
		return this.prisma.user;
	}
}