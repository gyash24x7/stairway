/// <reference types="vite/client" />

import type { HibernationPluginContext } from "@orpc/server/hibernation";
import type { ResponseHeadersPluginContext } from "@orpc/server/plugins";
import type { Session } from "../src/auth/types";

declare global {
	type Ctx = ResponseHeadersPluginContext & HibernationPluginContext & { session?: Session }
}