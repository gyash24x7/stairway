import { Injectable } from "@nestjs/common";
import { initTRPC } from "@trpc/server";

export type User = { id: string, name: string };

export type AuthContext = { authUser: User };

@Injectable()
export class TrpcService<Ctx extends AuthContext> {
	private t = initTRPC.context<Ctx>().create();
	procedure = this.t.procedure;
	router = this.t.router;
}
