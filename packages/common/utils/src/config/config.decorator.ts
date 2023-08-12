import { Inject } from "@nestjs/common";

export const CONFIG_DATA = "CONFIG_DATA";
export const Config = () => Inject( CONFIG_DATA );
