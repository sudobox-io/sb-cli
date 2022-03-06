const inquirer = require("inquirer");
const axios = require("axios");
const clear = require("clear");
const printInfo = require("../lib/printInfo");
const Table = require("cli-table");
const { promisify } = require("util");
const { setTimeout } = require("timers/promises");
const sleep = promisify(setTimeout);
const SettingsDB = require("../models/Settings");

const getApp = async (id) => {
  return new Promise(async (resolve, reject) => {
    try {
      const appSettings = await axios({
        method: "GET",
        url: `https://api.sudobox.io/v1/apps/${id}`,
        headers: { "Content-Type": "Application/json" },
      });
      resolve(appSettings.data);
    } catch (err) {
      console.log(err);
      reject(false);
    }
  });
};

const installApp = async (id, questions) => {
  return new Promise(async (resolve, reject) => {
    try {
      const installedApp = await axios({
        method: "POST",
        url: `${process.env.SB_BACKEND}/apps`,
        headers: { "Content-Type": "Application/json" },
        data: { id, questions },
      });
      resolve(installedApp.data.installed);
    } catch (err) {
      reject(false);
    }
  });
};

const deleteApp = async (id) => {
  return new Promise(async (resolve, reject) => {
    try {
      const deletedApp = await axios({
        method: "DELETE",
        url: `${process.env.SB_BACKEND}/apps`,
        headers: { "Content-Type": "Application/json" },
        data: { id },
      });
      resolve(deletedApp.data.deleted);
    } catch (err) {
      reject(false);
    }
  });
};

const performActionOnContainer = async (arr, action) => {
  const answer = await inquirer.prompt([
    {
      type: `input`,
      message: "Enter App(s) | App Range",
      name: "appsNumber",
    },
  ]);

  const range = answer.appsNumber.split("-");
  const multiple = answer.appsNumber.split(",");

  if (range.length === 1 && multiple.length === 1) {
    const id = arr[answer.appsNumber - 1].Id;
    const container = await axios({
      method: "POST",
      url: `${process.env.SB_BACKEND}/apps/action`,
      headers: {
        "Content-Type": "application/json",
      },
      data: {
        id,
        action,
      },
    });
  } else {
    try {
      let ids = [];
      if (range.length > 1) {
        for (let i = range[0] - 1; i < range[1]; i++) {
          let id = arr[i].Id;
          ids.push(id);
        }
      }

      if (multiple.length > 1) {
        for (let i of multiple) {
          let id = arr[i - 1].Id;
          ids.push(id);
        }
      }

      for (let id of ids) {
        const container = await axios({
          method: "POST",
          url: `${process.env.SB_BACKEND}/apps/action`,
          headers: {
            "Content-Type": "application/json",
          },
          data: {
            id,
            action,
          },
        });
      }
    } catch (err) {
      console.log(err);
    }
  }
};

const appStatus = async () => {
  let loop = true;
  do {
    clear();
    await printInfo();
    const table = new Table({
      head: ["#", "Name", "Status", "Uptime"],
      colWidths: [10, 30, 30, 30],
    });

    let index = 1;

    try {
      const dockerContainers = await axios.get(`${process.env.SB_BACKEND}/apps`);
      for (const container of dockerContainers.data.results.sort((first, second) => (first.State === second.State ? 0 : first.State == "running" ? -1 : 1))) {
        table.push([index++, container.Names[0].split("/")[1], container.State, container.Status]);
      }

      console.log(table.toString());
      console.log("");

      const answers = await inquirer.prompt([
        {
          type: `list`,
          message: "Select an action?",
          name: "apps",
          pageSize: 13,
          choices: [
            { name: "Start", value: "start" },
            { name: "Stop", value: "stop" },
            { name: "Restart", value: "restart" },
            { name: "Kill", value: "kill" },
            new inquirer.Separator(),
            { name: "Back", value: "back" },
            { name: "Exit", value: "exit" },
          ],
        },
      ]);

      switch (answers.apps) {
        case "start":
          await performActionOnContainer(dockerContainers.data.results, answers.apps);
          break;
        case "stop":
          await performActionOnContainer(dockerContainers.data.results, answers.apps);
          break;
        case "restart":
          break;
        case "kill":
          break;
        case "back":
          loop = false;
          break;
        case "exit":
          process.exit();
          break;
      }
    } catch (err) {
      console.log(err);
    }
  } while (loop);
};

const installApps = async () => {
  let appsBeingInstalled = [];
  let page = 1;

  let loop = true;

  do {
    clear();
    await printInfo();

    const apps = await axios.get(`https://api.sudobox.io/v1/apps?page=${page}`);

    const installedContainers = await axios.get(`${process.env.SB_BACKEND}/apps`);
    const mappedInstalledContainers = installedContainers.data.results.map((ctn) => ctn.Names[0].split("/")[1]);

    const filteredApps = apps.data.results
      .map((app) => ({ name: `${app.name}`, id: app._id }))
      .map((app) => ({ name: `${app.name} ${mappedInstalledContainers.includes(app.name) ? "✔️" : "❌"}`, value: { id: app.id, original: app.name } }))
      .map((app) =>
        appsBeingInstalled.some((app2) => app2.id === app.value.id)
          ? { name: `${app.name} ✅`, value: { name: app.name, id: app.value.id, original: app.value.original } }
          : { name: `${app.name}`, value: { name: app.name, id: app.value.id, original: app.value.original } }
      );

    const displayPages = () => {
      if (apps.data.totalPages > 1) {
        let tempArr = [new inquirer.Separator()];
        if (page > 1) tempArr.push({ name: "Page <", value: "pageBack" });
        if (page < apps.data.totalPages) tempArr.push({ name: "Page >", value: "pageNext" });
        return tempArr;
      } else {
        return [];
      }
    };

    const actionItems = () => {
      let tempArr = [];
      if (appsBeingInstalled.length > 0) tempArr.push({ name: "Install", value: "install" });
      tempArr.push({ name: "Back", value: "back" }, { name: "Exit", value: "exit" });
      return tempArr;
    };

    console.log("");
    console.log(`Page: ${page} / ${apps.data.totalPages} | ${apps.data.totalApps} available`);
    console.log("");
    console.log("✔️  Installed");
    console.log("❌  Not Installed");
    console.log("✅  Selected");
    console.log("");

    if (appsBeingInstalled.length >= 1) {
      console.log(`${appsBeingInstalled.length} Selected`);
      console.log("");
    }

    await inquirer
      .prompt([
        {
          type: `list`,
          message: "What app(s) would you like to install",
          name: "coreApps",
          pageSize: 20,
          choices: [...filteredApps, ...displayPages(), new inquirer.Separator(), ...actionItems()],
        },
      ])
      .then(async (answers) => {
        if (answers.coreApps === "back" || answers.coreApps === "exit" || answers.coreApps === "install" || answers.coreApps === "pageBack" || answers.coreApps === "pageNext") {
          switch (answers.coreApps) {
            case "back":
              loop = false;
              break;
            case "exit":
              process.exit();
              break;
            case "pageNext":
              page++;
              break;
            case "pageBack":
              page--;
              break;
            case "removeApps":
              await removeExistingApps(appsBeingRemoved, table);
              break;
            case "install":
              loop = false;

              const appsInstalling = {};
              const domain = await SettingsDB.findOne({ name: "domain" });

              for (const app of appsBeingInstalled) {
                clear();
                await printInfo();

                const appinfo = await getApp(app.id);

                let appQuestions;

                if (appinfo.results?.settings.includes("User_Prompts")) {
                  printMessage(["", "This app requires some extra information from you", "Please answer the following questions", ""], {
                    border: false,
                    color: "cyan",
                  });
                  appQuestions = await inquirer.prompt([
                    ...appinfo.results.userPrompts.map((question) => ({
                      type: "input",
                      name: question.name,
                      message: question.question,
                    })),
                  ]);
                }

                appsInstalling[app.original] = { status: "Installing...", message: "" };

                for (const [key, value] of Object.entries(appsInstalling)) {
                  console.log(`${key}: ${value.status}`);
                  if (value.message !== "") {
                    console.log(value.message);
                    console.log("");
                  }
                }

                const installedApp = await installApp(app.id, appQuestions);
                if (installedApp) {
                  appsInstalling[app.original].status = "Successfully Installed";
                  appsInstalling[app.original].message = `Accessible at: https://${app.original}.${domain.value}`;
                } else {
                  appsInstalling[app.original] = "Installation Failed";
                }
              }

              clear();
              await printInfo();
              for (const [key, value] of Object.entries(appsInstalling)) {
                console.log(`${key}: ${value.status}`);
                if (value.message !== "") {
                  console.log(value.message);
                  console.log("");
                }
              }

              console.log("");
              console.log(
                `${Object.entries(appsInstalling).length} apps queued - ${
                  Object.entries(appsInstalling)
                    .map((app) => app[1])
                    .filter((app) => app.status === "Successfully Installed").length
                } Successfully Installed`
              );
              console.log("");

              await inquirer
                .prompt([
                  {
                    type: `confirm`,
                    message: "Would you like to install more Apps?",
                    name: "appInstallConfirm",
                  },
                ])
                .then((answers2) => {
                  if (answers2.appInstallConfirm) {
                    appsBeingInstalled = [];
                    loop = true;
                  }
                });
              break;
          }
        } else {
          if (mappedInstalledContainers.includes(answers.coreApps.original)) return;
          if (appsBeingInstalled.some((app) => app.id === answers.coreApps.id)) {
            appsBeingInstalled = appsBeingInstalled.filter((app) => app.id !== answers.coreApps.id);
          } else {
            appsBeingInstalled.push(answers.coreApps);
          }
        }
      });
  } while (loop);
};

const deleteApps = async () => {
  let appsBeingRemoved = [];
  let installedApps = await axios.get(`${process.env.SB_BACKEND}/apps`);
  let page = 1;
  let loop = true;

  do {
    clear();
    await printInfo();

    const displayPages = () => {
      if (installedApps.data.results.length > 10) {
        let tempArr = [new inquirer.Separator()];
        if (page > 1) tempArr.push({ name: "Page <", value: "pageBack" });
        if (page < Math.ceil(installedApps.data.results.length / 10)) tempArr.push({ name: "Page >", value: "pageNext" });
        return tempArr;
      } else {
        return [];
      }
    };

    const filteredApps = (amount) => {
      const chunkedApps = installedApps.data.results.reduce((resultArray, item, index) => {
        const chunkIndex = Math.floor(index / amount);

        if (!resultArray[chunkIndex]) {
          resultArray[chunkIndex] = [];
        }

        resultArray[chunkIndex].push(item);

        return resultArray;
      }, []);

      return chunkedApps;
    };

    let chunkedApps = filteredApps(10);

    let apps = [...chunkedApps[page - 1]].map((app) =>
      appsBeingRemoved.some((app2) => app2.id === app.Id) ? { name: `${app.Names[0].split("/")[1]} ✅`, id: app.Id } : { name: `${app.Names[0].split("/")[1]}`, id: app.Id }
    );

    const actionItems = () => {
      let tempArr = [];
      if (appsBeingRemoved.length > 0) tempArr.push({ name: "Delete", value: "delete" });
      tempArr.push({ name: "Back", value: "back" }, { name: "Exit", value: "exit" });
      return tempArr;
    };

    console.log("");
    console.log(`Page: ${page} / ${chunkedApps.length} | ${installedApps.data.results.length} Apps installed!`);
    console.log("");
    console.log("✅  Selected");
    console.log("");

    await inquirer
      .prompt([
        {
          type: `list`,
          message: "What app(s) would you like to delete",
          name: "coreApps",
          pageSize: 20,
          choices: [...apps.map((app) => ({ name: app.name, value: app })), ...displayPages(), new inquirer.Separator(), ...actionItems(), new inquirer.Separator()],
        },
      ])
      .then(async (answers) => {
        if (
          answers.coreApps === "back" ||
          answers.coreApps === "exit" ||
          answers.coreApps === "delete" ||
          answers.coreApps === "pageNext" ||
          answers.coreApps === "pageBack" ||
          answers.coreApps === "removeApps"
        ) {
          switch (answers.coreApps) {
            case "back":
              loop = false;
              break;
            case "exit":
              process.exit();
              break;
            case "pageNext":
              page++;
              break;
            case "pageBack":
              page--;
              break;
            case "delete":
              clear();
              loop = false;

              const appsDeleting = {};

              for (const app of appsBeingRemoved) {
                clear();
                await printInfo();

                appsDeleting[app.name] = "Deleting...";

                for (const [key, value] of Object.entries(appsDeleting)) {
                  console.log(`${key}: ${value}`);
                }

                const deletedApp = await deleteApp(app.id);

                console.log(deletedApp);

                if (deletedApp) {
                  appsDeleting[app.name] = "Successfully Deleted";
                } else {
                  appsDeleting[app.name] = "Deletion Failed";
                }
              }

              clear();
              await printInfo();
              for (const [key, value] of Object.entries(appsDeleting)) {
                console.log(`${key}: ${value}`);
              }

              console.log("");
              console.log(
                `${Object.entries(appsDeleting).length} Apps Queued - ${
                  Object.entries(appsDeleting)
                    .map((app) => app[1])
                    .filter((app) => app === "Successfully Deleted").length
                } Successfully Deleted`
              );
              console.log("");

              await inquirer
                .prompt([
                  {
                    type: `confirm`,
                    message: "Would you like to delete more Apps?",
                    name: "appInstallConfirm",
                  },
                ])
                .then(async (answers2) => {
                  if (answers2.appInstallConfirm) {
                    appsBeingRemoved = [];
                    installedApps = await axios.get(`${process.env.SB_BACKEND}/apps`);
                    loop = true;
                  }
                });

              break;
          }
        } else {
          if (appsBeingRemoved.some((app2) => app2.id === answers.coreApps.id)) {
            appsBeingRemoved = appsBeingRemoved.filter((app) => app.id !== answers.coreApps.id);
          } else {
            appsBeingRemoved.push(answers.coreApps);
          }
        }
      });
  } while (loop);
};

module.exports = apps = async () => {
  let loop = true;
  do {
    clear();
    await printInfo();
    let i = 0;
    await inquirer
      .prompt({
        type: "list",
        message: "What would you like to do?",
        name: "menu",
        pageSize: 10,
        choices: [
          { name: `${++i}.) Install`, value: "installApps" },
          { name: `${++i}.) Delete`, value: "deleteApps" },
          { name: `${++i}.) Status`, value: "status" },
          new inquirer.Separator(),
          { name: "Back", value: "back" },
          { name: "Exit", value: "exit" },
        ],
      })
      .then(async (answers) => {
        switch (answers.menu) {
          case "installApps":
            await installApps();
            break;
          case "deleteApps":
            await deleteApps();
            break;
          case "status":
            await appStatus();
            break;
          case "back":
            loop = false;
            break;
          case "exit":
            process.exit();
            break;
          default:
            process.exit();
            break;
        }
      });
  } while (loop);
};
