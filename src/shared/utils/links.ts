import { linkFor } from "rwsdk/router";
import type * as Worker from "../../worker";

type App = typeof Worker.app;

export const link = linkFor<App>();