import { PrismaClient } from "@prisma/client";

// A single shared Prisma client, reused everywhere. Creating a new client per
// request/job would exhaust DB connections under load.
export const prisma = new PrismaClient();
