// This file infers types for the cloudflare:workers environment from your Alchemy Worker.
// @see https://alchemy.run/concepts/bindings/#type-safe-bindings

import type { authWorker, callbreakWorker, fishWorker, webWorker, wordleWorker } from "../alchemy.run.ts";

declare global {
	export type AuthWorkerEnv = typeof authWorker.Env;
	export type WebWorkerEnv = typeof webWorker.Env;
	export type WordleWorkerEnv = typeof wordleWorker.Env;
	export type CallbreakWorkerEnv = typeof callbreakWorker.Env;
	export type FishWorkerEnv = typeof fishWorker.Env;
	export type DataResponse<T> = { data?: T, error?: string }
	export type ErrorResponse = DataResponse<undefined>
}

export type CloudflareEnv = WebWorkerEnv & AuthWorkerEnv;

declare module "cloudflare:workers" {
	namespace Cloudflare {
		export interface Env extends CloudflareEnv {}
	}
}

declare module "bun" {
	interface Env {
		AUTH_SECRET_KEY: string;
		WEBAUTHN_RP_ID: string;
		APP_URL: string;
	}
}

