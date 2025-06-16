import { AppContext } from "@/worker";

declare module "rwsdk/worker" {
	interface DefaultAppContext extends AppContext {}
}
