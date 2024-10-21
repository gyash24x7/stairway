import { auth } from "@/utils/auth.ts";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler( auth.handler );