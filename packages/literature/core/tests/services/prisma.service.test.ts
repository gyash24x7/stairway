import { expect, test } from "vitest";
import type { BasePrismaService } from "@s2h/core";
import { mockDeep } from "vitest-mock-extended";
import { PrismaService } from "../../src/services";

test( "PrismaService should map model name delegates to BasePrismaService", () => {
	const mockBasePrismaService = mockDeep<BasePrismaService>();
	const prismaService = new PrismaService( mockBasePrismaService );

	expect( prismaService.game ).toBe( mockBasePrismaService.literatureGame );
	expect( prismaService.player ).toBe( mockBasePrismaService.literaturePlayer );
	expect( prismaService.cardMapping ).toBe( mockBasePrismaService.literatureCardMapping );
	expect( prismaService.team ).toBe( mockBasePrismaService.literatureTeam );
	expect( prismaService.move ).toBe( mockBasePrismaService.literatureMove );
} );