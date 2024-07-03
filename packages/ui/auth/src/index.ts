import type { createConfig } from "@gluestack-ui/themed";

export * from "./components";
export * from "./store";

declare module "@gluestack-style/react" {
	interface ICustomConfig extends ReturnType<typeof createConfig> {}
}