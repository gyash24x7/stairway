import { Module } from "@nestjs/common";
import { TrpcService } from "./trpc.service.ts";

@Module( {
	providers: [ TrpcService ],
	exports: [ TrpcService ]
} )
export class TrpcModule {}

