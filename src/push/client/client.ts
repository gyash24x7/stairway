import { client, run } from "@/client.ts";

import type { WebPushSubscription } from "@/push/shared/schema.ts";

export const subscribePushFn = ( payload: WebPushSubscription ) =>
	run( client.push.subscribe( { payload } ) );

export const unsubscribePushFn = ( endpoint: string ) =>
	run( client.push.unsubscribe( { payload: { endpoint } } ) );

export const sendTestPushFn = () => run( client.push.test() );
