import { describe, expect, it } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { BasePrismaService } from "@s2h/core";
import { PrismaService } from "../../src/services";

describe( "PrismaService", () => {

	const mockBasePrisma = mockDeep<BasePrismaService>();
	const prismaService = new PrismaService( mockBasePrisma );

	it( "should return the user model", () => {
		expect( prismaService.user ).toEqual( mockBasePrisma.user );
	} );
	
} );