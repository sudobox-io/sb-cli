const inquirer = require("inquirer");
const axios = require("axios");
const clear = require("clear");
const printInfo = require("../lib/printInfo");
const { promisify } = require("util");
const SettingsDB = require("../models/Settings");

const sleep = promisify(setTimeout);

const detectDisplayTerm = (value) => {};

const changeSettings = async (setting, type) => {
  clear();
  await printInfo();
  const settingsMap = {
    domain: "domain",
    name: "name",
    dashboard: "dashboard",
    local: "local",
    cfEmail: "Cloudflare_Email",
    cfApiKey: "Cloudflare_API_Key",
  };

  const sudoboxSettings = await SettingsDB.findOne({});
  let question = {};

  if (type.trim() === "string") {
    question = {
      type: "input",
      message: `Enter new value for: ${setting}`,
      name: "setting",
    };
  }

  if (type.trim() === "bool") {
    question = {
      type: "confirm",
      name: "setting",
      message: `Would you like to Enable / Disable ${setting}`,
    };
  }

  await inquirer.prompt([question]).then(async (answer) => {
    if (!sudoboxSettings) {
      const settingsOptions = {};
      settingsOptions[settingsMap[setting.trim()]] = answer.setting;
      const newSetttings = SettingsDB(settingsOptions);
      await newSetttings.save();
    } else {
      sudoboxSettings[settingsMap[setting.trim()]] = answer.setting;
      await sudoboxSettings.save();
    }
  });
};

module.exports = Settings = async () => {
  let loop = false;
  do {
    const sudoboxSettings = await SettingsDB.find({});
    clear();
    await printInfo();
    let i = 0;
    await inquirer
      .prompt({
        type: "list",
        message: "What would you like to change?",
        name: "menu",
        pageSize: 10,
        choices: [
          ...sudoboxSettings.map((setting) => ({ name: `${++i}.) ${setting.name} ( ${setting.value} )`, value: setting.value })),
          new inquirer.Separator(),
          { name: "Back", value: "back" },
          { name: "Exit", value: "exit" },
        ],
      })
      .then(async (answers) => {
        switch (answers.menu) {
          case "back":
            loop = false;
            break;
          case "exit":
            process.exit();
            break;
          default:
            // const splitValue = answers.menu.trim().split("|");
            // await changeSettings(splitValue[0], splitValue[1]);
            loop = true;
            break;
        }
      });
  } while (loop);
};
