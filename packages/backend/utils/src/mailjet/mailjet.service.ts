import { Injectable } from "@nestjs/common";
import mailjet from "node-mailjet";
import type { Client } from "node-mailjet";
import { LoggerFactory } from "../logger";

export type EmailData = {
	name: string;
	email: string;
	subject: string;
	content: string;
}

@Injectable()
export class MailjetService {

	private readonly logger = LoggerFactory.getLogger( MailjetService );

	private readonly mailjet: Client;

	constructor() {
		const apiKey = process.env[ "MAILJET_API_KEY" ]!;
		const apiSecret = process.env[ "MAILJET_API_SECRET" ]!;
		this.mailjet = mailjet.apiConnect( apiKey, apiSecret );
	}

	async sendEmail( data: EmailData ) {
		await this.mailjet.post( "send", { version: "v3.1" } ).request( {
			Messages: [
				{
					To: [ { Email: data.email, Name: data.name } ],
					From: { Email: "stairway@yashgupta.me", Name: "Stairway" },
					Subject: data.subject,
					TextPart: data.content
				}
			]
		} ).catch( err => {
			this.logger.error( "Error Sending Email! %s", err.message )
		} )
	}
}