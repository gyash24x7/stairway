import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { SessionServiceLive } from "@/auth/server/session.ts";
import { ChatService } from "@/chat/server/service.ts";
import { WebSocketDurableObject } from "@/platform/do/ws.ts";
import { SessionStoreLive } from "@/platform/kv/session.ts";


// --- Chat Durable Object ---------------------------------------------------------

export class ChatChannel extends Cloudflare.DurableObject<ChatChannel>()(
	"ChatChannel",
	WebSocketDurableObject( ChatService ).pipe(
		Effect.provide(
			SessionServiceLive.pipe(
				Layer.provide( SessionStoreLive ),
				Layer.provide( Cloudflare.KV.ReadWriteNamespaceBinding )
			)
		)
	)
) {}
