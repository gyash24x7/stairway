import { Injectable } from "@nestjs/common";
import { initTRPC } from "@trpc/server";

export type User = { id: string, name: string };

export type AuthContext = { authUser: User };

@Injectable()
export class TrpcService {
	private t = initTRPC.context<AuthContext>().create();
	procedure = this.t.procedure;
	router = this.t.router;
}
