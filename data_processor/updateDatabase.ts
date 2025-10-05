import log from "../lib/logger";
import { downloadLatestData } from "./downloadLatestData";

// update database with new nasa data
// not to be confused!!
function updateDatabase(): number {
  downloadLatestData();
  return Date.now();
}

export default updateDatabase;
