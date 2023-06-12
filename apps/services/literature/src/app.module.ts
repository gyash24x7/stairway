import { Module } from "@nestjs/common";
import { LiteratureModule } from "@s2h/literature/core";

@Module( { imports: [ LiteratureModule ] } )
export class AppModule {}
