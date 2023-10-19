import { Injectable } from "@nestjs/common";
import { BasePrismaService } from "@s2h/core";

@Injectable()
export class PrismaService {

	constructor( private readonly prisma: BasePrismaService ) {}

	get game() {
		return this.prisma.literatureGame;
	}

	get player() {
		return this.prisma.literaturePlayer;
	}

	get cardMapping() {
		return this.prisma.literatureCardMapping;
	}

	get team() {
		return this.prisma.literatureTeam;
	}

	get move() {
		return this.prisma.literatureMove;
	}
}