import { AppContext } from "@/worker";

declare module "rwsdk/worker" {
	interface DefaultAppContext extends AppContext {}
}

declare global {
	export type ErrorOnlyResponse = { error?: string };
	export type DataResponse<T> = { data?: T } & ErrorOnlyResponse;
}