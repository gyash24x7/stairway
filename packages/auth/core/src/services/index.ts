import { JwtService } from "./jwt.service";
import { PrismaService } from "./prisma.service";

export * from "./jwt.service";
export * from "./prisma.service";

export const services = [ JwtService, PrismaService ];