import { Global, Module } from "@nestjs/common";
import { MailjetService } from "./mailjet.service.ts";

@Global()
@Module( {
	providers: [ MailjetService ],
	exports: [ MailjetService ]
} )
export class MailjetModule {}