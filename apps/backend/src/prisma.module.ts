import { Global, Module } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

@Global()
@Module( {
	providers: [ { provide: "PRISMA_CLIENT", useValue: prisma } ],
	exports: [ "PRISMA_CLIENT" ]
} )
export class PrismaModule {}