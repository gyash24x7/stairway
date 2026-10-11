import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpServerRequest from "effect/http/HttpServerRequest";

import { AuthContext } from "@/auth/contract";
import { NotificationsApi } from "@/notifications/contract";
import { PushRepository, Vapid } from "@/notifications/server/push";


export const NotificationsApiLive = HttpApiBuilder.group(
	NotificationsApi,
	"notifications",
	Effect.fn( function* ( handlers ) {
		const vapid = yield* Vapid;
		const repository = yield* PushRepository;
		const publicKey = Option.getOrNull( Option.map( vapid, keys => keys.publicKey ) );

		return handlers
			.handle( "key", () => Effect.succeed( { publicKey } ) )
			.handle( "subscribe", ( { payload } ) => Effect.gen( function* () {
				const user = yield* AuthContext;
				const request = yield* HttpServerRequest.HttpServerRequest;
				yield* repository.save( user.id, payload, request.headers[ "user-agent" ] );
			} ) )
			.handle( "unsubscribe", ( { payload } ) => Effect.gen( function* () {
				const user = yield* AuthContext;
				yield* repository.remove( user.id, payload.endpoint );
			} ) );
	} )
);
