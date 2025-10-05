import prisma from "../prisma/prisma";
import log from "./logger";

export async function isDatabaseHealthy(): Promise<boolean> {
  let returnval = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e: any) {
    log("fatal", "Database", e.toString());
    returnval = false;
  }
  
  return returnval;
}
