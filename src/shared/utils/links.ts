import { linkFor } from "rwsdk/router";
import type * as Worker from "../../worker";

type App = typeof Worker.app;

/**
 * Type-safe link helper for the app's route definitions.
 * Returns a function that generates URL paths matching the routes defined in the worker.
 */
export const link = linkFor<App>();
