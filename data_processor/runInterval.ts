import { checkerIntervalDuration } from "../globalvars";
import log from "../lib/logger";
import moment from "moment";
import updateDatabase from "./updateDatabase";

function runInterval(): void {
  log(
    "info",
    "Interval",
    "First run of runInterval() at " + moment().format("YYYY:MM:DD HH:mm:ss"),
  );

  updateDatabase();
  setInterval(
    () => {
      updateDatabase();
      log(
        "info",
        "Interval",
        "Run of runInterval() at " + moment().format("YYYY:MM:DD HH:mm:ss"),
      );
    },
    checkerIntervalDuration * 60 * 1000,
  );
}

export default runInterval;
