import type { createConfig } from "@gluestack-ui/themed";

export * from "./components";
export * from "./utils";

declare module "@gluestack-style/react" {
	interface ICustomConfig extends ReturnType<typeof createConfig> {}
}