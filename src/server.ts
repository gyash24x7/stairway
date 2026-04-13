import handler from "@tanstack/react-start/server-entry";

export { SyncServer } from "@/shared/engine/sync";

export default { fetch: handler.fetch };
