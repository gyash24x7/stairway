import { Module } from "@nestjs/common";
import { ConfigModule } from "../config";
import { BasePrismaService } from "./prisma.service";

@Module( {
	imports: [ ConfigModule ],
	providers: [ BasePrismaService ],
	exports: [ BasePrismaService ]
} )
export class PrismaModule {}
