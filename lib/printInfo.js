const figlet = require("figlet");
const clear = require("clear");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const Table = require("cli-table");

const axios = require("axios");

module.exports = printInfo = async () => {
  let sbCliStatus = false;
  try {
    const result = await axios({
      method: "POST",
      url: `${process.env.SB_BACKEND}/status`,
      headers: { "Content-Type": "Application/json" },
      data: { url: "https://api.sudobox.io/v1/apps" },
    });
    sbCliStatus = result.data.reachable;
  } catch (err) {}

  const table = new Table({
    head: ["CLI Version", "SB-API Status"],
    colWidths: [25, 25],
  });

  clear();
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "./package.json")));
  table.push([packageJson.version, sbCliStatus ? "OK ✅" : "ERROR"]);
  console.log(chalk.cyan(figlet.textSync("Sudobox-CLI")));
  console.log("");
  console.log(table.toString());
  console.log("");
};
