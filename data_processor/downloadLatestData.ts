import exec from "child_process";
import prisma from "../prisma/prisma";
import moment from "moment";
import log from "../lib/logger";
import { readdirSync, readFileSync } from "fs";
import { readdir } from "fs/promises";
import yaml from "js-yaml";
import { LatLongPairs } from "@prisma/client";
import { callbackify } from "util";

export async function downloadLatestData(): Promise<void> {
  const ISOTimestampNow = moment().format("YYYY-MM-DDTHH:mm:ss") + "Z";

  command(() => {
    const dir: string[] = readdirSync("./data");
    dir.forEach(async (file) => {
      const tmp = file.split(".");
      if (
        !(
          tmp[0] == "" ||
          tmp[tmp.length - 1] != "txt" ||
          file.includes("citation")
        )
      ) {
        log("info", "downloadLatestData", "Running process() for file " + file);
        await process(readFileSync("./data/" + file).toString());
      }
    });
  }, ISOTimestampNow);
}

async function command(_callback: Function, ISOTimestampNow: string) {
  try {
    log(
      "info",
      "downloadLatestData",
      "Receiving/checking for new data via PODAAC...",
    );
    const child = exec.exec(
      "podaac-data-downloader -c TELLUS_GRFO_L3_JPL_RL06.3_LND_v04 -d ./data --start-date 2023-01-01T00:00:00Z --end-date " +
        ISOTimestampNow +
        ' -e ""',
    );

    child.on("exit", () => {
      log("info", "downloadLatestData", "PODAAC done");
      _callback();
    });
  } catch (e: any) {
    log("critical", "downloadLatestData", e.toString());
  }
}

async function process(d: string) {
  const data = d.split("# End of YAML header")[1]?.split("\n") || [""];
  const isoTimestamp = d
    .split("# End of YAML header")[0]
    ?.split("\n")
    .filter((a) => a.includes("time_coverage"))[1]
    ?.split(": ")[1]
    ?.replaceAll(" ", "");

  const latestTimestamp = (await prisma.latLongPairs.findFirst({
    orderBy: {
      timestamp: "desc",
    },
  })) || { timestamp: 0 };

  if (moment(isoTimestamp).unix() <= latestTimestamp.timestamp) {
    log(
      "info",
      "downloadLatestData",
      "Data for " +
        moment(isoTimestamp).format("YYYY/MM/DD") +
        " is found yet an existing, newer timestamp is found.",
    );
    return;
  }

  const processed: string[][] = [];
  data.forEach((entry, i) => {
    processed.push(
      entry
        .split(" ")
        .filter((a) => a != "")
        .join("")
        .split("\t"),
    );
  });

  let prismaCreate: LatLongPairs[] = [];

  processed.forEach(async (data) => {
    prismaCreate.push({
      //@ts-ignore
      // this is a horrible solution
      entry: Date.now() * Math.random(),
      timestamp: moment(isoTimestamp).unix(),
      lon: parseFloat(data[0] || "0"),
      lat: parseFloat(data[1] || "0"),
      lwe: parseFloat(data[2] || "0"),
      uncertainty: parseFloat(data[3] || "0"),
    });
  });

  await prisma.latLongPairs
    .createMany({
      data: prismaCreate,
    })
    .catch((e) => {
      console.log(e);
    })
    .then((a) => {
      log(
        "info",
        "downloadLatestData",
        "Added new data for timestamp " +
          moment(isoTimestamp).format("YYYY/MM/DD") +
          "! +" +
          prismaCreate.length +
          " rows.",
      );
    });
  // garbagecollection
  prismaCreate = [];
}
