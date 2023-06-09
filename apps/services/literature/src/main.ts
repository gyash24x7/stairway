import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import path from "path";

async function bootstrap() {
	const app = await NestFactory.createMicroservice<MicroserviceOptions>(
		AppModule,
		{
			transport: Transport.GRPC,
			options: {
				package: "literature",
				protoPath: path.join( __dirname, "proto/literature.proto" )
			}
		}
	);

	await app.listen();
	Logger.log( "Literature Microservice is running!" );
}

bootstrap().then();
