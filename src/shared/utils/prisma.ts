import { PrismaClient } from "@/prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";

export let prisma: PrismaClient;

export async function setupPrisma( env: Env ) {
	if ( prisma ) {
		return;
	}

	prisma = new PrismaClient( {
		adapter: new PrismaD1( env.DB )
	} );

	await prisma.$queryRaw`SELECT 1`;
}