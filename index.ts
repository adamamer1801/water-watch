// All human written code
// We don't use ChatGPT here

import express, { Express, NextFunction, Request, Response } from "express";
import moment from "moment";
import log from "./lib/logger";
import prisma from "./prisma/prisma";
import { port } from "./globalvars";
import { createServer as createServerHttp } from "http";
import runInterval from "./data_processor/runInterval";
import { isDatabaseHealthy } from "./lib/database_alive";

const app: Express = express();
const cors = require("cors");
const initTimestamp = Date.now();

app
  .use((req: Request, res: Response, next: NextFunction) => {
    log("info", "API", "New request for " + req.path + " from " + req.ip);
    next();
  })
  .use(cors());

// default GET for uptime
app.get("/", (req: Request, res: Response) => res.status(200).send("/ 200"));
app.get("/uptime", (req: Request, res: Response) =>
  res.status(200).send("Up since " + moment(initTimestamp).fromNow()),
);
app.get("/db_status", async (req: Request, res: Response) => {
  await isDatabaseHealthy().then((healthy: boolean) => {
    if (healthy) res.status(200).send("Database is connected and working");
    else res.status(500).send("Database is disconnected or injured");
  });
});

app.get("/timestamps", async (req: Request, res: Response) => {
  await prisma.latLongPairs
    .findMany({
      distinct: ["timestamp"],
      select: {
        timestamp: true,
      },
    })
    .then((data) => {
      let resp: number[] = [];

      data.forEach((a) => resp.push(a.timestamp));
      res.status(200).send(resp);
    });
});

app.get("/timestamp/:timestamp", async (req: Request, res: Response) => {
  let param = req.params.timestamp;

  if (typeof param == "undefined") {
    res.status(400).send("Invalid timestamp");
    return;
  }

  const timestamp = parseInt(param);

  await prisma.latLongPairs
    .findMany({
      where: {
        timestamp: timestamp,
      },
    })
    .then((data) => {
      res.status(200).send(data);
    });
});

// notification system

app.get("/location/:lat/:lon", async (req: Request, res: Response) => {
  let lat = req.params.lat;
  let lon = req.params.lon;

  if (typeof lat == "undefined" || typeof lon == "undefined") {
    res.status(400).send("/location/:lat/:lon (get it right)");
    return;
  }

  let latParsed = parseFloat(lat);
  let lonParsed = parseFloat(lon);

  await prisma.latLongPairs
    .findMany({
      where: {
        lat: latParsed,
        lon: lonParsed,
      },
      orderBy: {
        timestamp: "desc",
      },
    })
    .then((data) => {
      res.status(200).send(data);
      return;
    });
});

app.get("/trend/:lat/:lon", async (req: Request, res: Response) => {
  let lat = req.params.lat;
  let lon = req.params.lon;

  if (typeof lat == "undefined" || typeof lon == "undefined") {
    res.status(400).send("/location/:lat/:lon (get it right)");
    return;
  }

  let latParsed = parseFloat(lat);
  let lonParsed = parseFloat(lon);

  const data = await prisma.latLongPairs.findMany({
    where: {
      lat: latParsed,
      lon: lonParsed,
    },
    orderBy: {
      timestamp: "desc",
    },
  });

  if (data == undefined) {
    res.status(400).send("No data");
    return;
  }
  let processed: number[][] = [];

  data.forEach((entry, i) => {
    if (i != 0) {
      if (typeof data[i - 1] != "undefined") {
        processed.push([entry.timestamp, (data[i - 1]?.lwe || 0) - entry.lwe]);
      }
    } else {
      processed.push([entry.timestamp, 0]);
    }
  });

  res.status(200).send(processed);
});

const init = async () => {
  runInterval();

  //db
  if (!(await isDatabaseHealthy())) throw Error;
  else log("info", "Init", "Database connected and healthy");

  // implement https later
  createServerHttp(app).listen(port);
  log("info", "express", "API online at http://127.0.0.1:" + port);
};

init()
  .then(() => {
    log("info", "Init", "Initialization successful (hopefully).");
  })
  .catch((e: Error) => {
    log("info", "fatal", "Initialization failed, it's better to quit");
    console.log(e);
    process.exit();
  });
