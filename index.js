const inquirer = require("inquirer");
const clear = require("clear");
const { apps, settings } = require("./submenus");
const initQuestions = require("./lib/initQuestions");
const mongoose = require("mongoose");

const Settings = require("./models/Settings");

require("dotenv").config();

// Mongoose connection
mongoose
  .connect(`${process.env.MONGO_URL_STRING}`, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .catch((err) => {
    console.log("There was an error connecting the the MongoDB Database.\nPlease make sure the mongo container is running");
    process.exit();
  });

const printInfo = require("./lib/printInfo");

process.on("SIGTERM", () => {
  process.exit();
});

const mainMenu = async () => {
  let updateAvailable = false;

  do {
    let i = 0;
    await printInfo();
    actions = [];
    await inquirer
      .prompt([
        {
          type: "list",
          message: "What would you like to do?",
          name: "menu",
          pageSize: 10,
          choices: [
            { name: `${++i}.) Apps`, value: "Apps" },
            { name: `${++i}.) Settings`, value: "Settings" },
            { name: `${++i}.) Tools ( Coming Soon )`, value: "Tools" },
            { name: `${++i}.) Backup / Restore ( Coming Soon )`, value: "Vault" },
            { name: `${++i}.) Update ( Coming Soon )`, value: "Update" },
            { name: `${++i}.) Check Sudobox Status ( Coming Soon )`, value: "Status" },
            new inquirer.Separator(),
            { name: "Exit", value: "Exit" },
          ],
        },
      ])
      .then(async (answers) => {
        switch (answers.menu) {
          case "Apps":
            await apps();
            break;
          case "Settings":
            await settings();
            break;
          case "Vault":
            break;
          case "Update":
            break;
          case "Exit":
            clear();
            process.exit(0);
            break;
          case "exit":
            process.exit();
            break;
          default:
            break;
        }
      });
  } while (true);
};

const init = async () => {
  await printInfo();

  // Check if settings exist -> run setup wizard if none exist
  const settings = await Settings.find({});
  if (!settings || settings.length === 0) {
    await initQuestions();
  }

  // start main menu
  await mainMenu();
};

(async () => {
  await init();
})();
