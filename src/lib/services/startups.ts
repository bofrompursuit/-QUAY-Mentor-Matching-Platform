import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { ConflictError, NotFoundError } from "../errors";
import { startupInput, type StartupInput } from "../validation";

export async function listStartups() {
  return prisma.startup.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { requests: true } } } });
}

export async function getStartup(id: string) {
  const startup = await prisma.startup.findUnique({
    where: { id },
    include: { requests: { orderBy: { createdAt: "desc" }, include: { mentor: true } } },
  });
  if (!startup) throw new NotFoundError("Startup");
  return startup;
}

export async function createStartup(input: StartupInput) {
  const data = startupInput.parse(input);
  try {
    return await prisma.startup.create({ data });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ConflictError(`Startup ${data.name} already exists`);
    }
    throw err;
  }
}
