// The calibration target: answers "OK" to every request over HTTPS and does
// nothing else. It is written in Node, like the shortener, so the tools check
// also shows the ceiling of Node's HTTPS handling alone on a given machine.
//   node ok.mjs [PORT] [CERT_DIR]
import { createServer } from "node:https";
import { readFileSync } from "node:fs";

const port = Number(process.argv[2] ?? 443);
const certDir = process.argv[3] ?? "/opt/sfp/tls";

createServer(
  { key: readFileSync(`${certDir}/key.pem`), cert: readFileSync(`${certDir}/cert.pem`) },
  (req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("OK");
  },
).listen(port, () => console.log(`ok server listening on ${port}`));
