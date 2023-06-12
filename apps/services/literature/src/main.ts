import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import path from "path";
import { LiteratureModule } from "@s2h/literature/core";

async function bootstrap() {
	const app = await NestFactory.createMicroservice<MicroserviceOptions>(
		LiteratureModule,
		{
			transport: Transport.GRPC,
			options: {
				package: "literature",
				protoPath: path.join( __dirname, "assets/literature.proto" )
			}
		}
	);

	await app.listen();
	Logger.log( "Literature Microservice is running!" );
}

bootstrap().then();
