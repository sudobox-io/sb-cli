const inquirer = require("inquirer");
const axios = require("axios");
const clear = require("clear");
const printInfo = require("../lib/printInfo");
const Table = require("cli-table");
const { promisify } = require("util");
const { TCPClient } = require("dns2");
const publicIp = require("public-ip");
const generator = require("generate-password");
const commandLineArgs = require("command-line-args");
const fs = require("fs");
const readFile = promisify(fs.readFile);
const path = require("path");
const yaml = require("yaml");
const printMessage = require("print-message");

const Setting = require("../models/Settings");

const resolve = TCPClient({
  dns: "1.1.1.1",
});

module.exports = initQuestions = async () => {
  const options = commandLineArgs(
    [
      { name: "config", alias: "c", type: Boolean },
      { name: "purge", type: Boolean },
    ],
    { partial: true }
  );

  printMessage(
    [
      "Welcome to the SudoBox Installation Wizard",
      "",
      "You MUST proceed through these steps in order to setup your very own SudoBox Server!",
      "",
      "For more information and step by step guides, please go to:",
      "https://docs.sudobox.io/Get-Started/Installation/installer/",
      "",
    ],
    {
      border: false,
      color: "cyan",
    }
  );

  let configFile = null;
  if (Object.keys(options).length !== 0 && options?.config === true) {
    try {
      file = await readFile(path.join("/configs", "cli-settings.yml"), "utf8");
      configFile = await yaml.parse(file);
      printMessage(["Config File has successfully been loaded!"], {
        border: false,
        color: "green",
      });
      if (!options?.purge) console.log("");
    } catch (err) {
      console.log({ err });
      console.log(`There was a problem accessing /configs/cli-settings.yml`);
      process.exit();
    }
  }

  if (Object.keys(options).length !== 0 && options?.purge === true) {
    printMessage(["Settings have been successfully purged!!"], {
      border: false,
      color: "red",
    });
    console.log("");
  }

  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "storage",
      message: "How would you like to store your data?",
      choices: ["Local", "Cloud"],
      default: configFile && configFile.storage,
    },
    {
      type: "confirm",
      name: "uploadAmount",
      message: "Will you be uploading more than 750GB of data per day?",
      default: configFile && configFile?.storage === "Cloud" && true,
      when: (answers) => {
        return answers.storage === "Cloud";
      },
    },
    {
      type: "input",
      name: "domain",
      message: "What is your domain?",
      default: configFile && configFile?.domain,
      validate: async (value) => {
        const domainReg =
          /^(?:(?:(?:[a-zA-z\-]+)\:\/{1,3})?(?:[a-zA-Z0-9])(?:[a-zA-Z0-9\-\.]){1,61}(?:\.[a-zA-Z]{2,})+|\[(?:(?:(?:[a-fA-F0-9]){1,4})(?::(?:[a-fA-F0-9]){1,4}){7}|::1|::)\]|(?:(?:[0-9]{1,3})(?:\.[0-9]{1,3}){3}))(?:\:[0-9]{1,5})?$/;
        if (domainReg.test(String(value).toLowerCase())) {
          try {
            const result = await resolve(value);
            const ipv4 = await publicIp.v4();
            if (result.answers[0].address === ipv4) {
              return true;
            } else {
              return `Make sure your domain points to this servers IP. Your IP: ${ipv4}`;
            }
          } catch (error) {
            return `Make sure your domain points to this servers IP. Your IP: ${ipv4}`;
          }
        } else {
          return "Please provide a valid domain";
        }
      },
    },
    {
      type: "input",
      name: "cloudflare_email",
      message: "Please enter your CloudFlare Email?",
      default: configFile && configFile?.cloudflare_email,
      validate: (value) => {
        const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        if (emailRegex.test(String(value).toLowerCase())) {
          return true;
        } else {
          return "Invalid Email";
        }
      },
    },
    {
      type: "input",
      name: "cloudflare_global_api",
      message: "Please enter your CloudFlare Api Key?",
      default: configFile && configFile?.cloudflare_global_api,
      validate: async (value, answers) => {
        try {
          const cfUser = await axios({
            method: "GET",
            url: "https://api.cloudflare.com/client/v4/user",
            headers: {
              "X-Auth-Email": answers.cloudflare_email,
              "X-Auth-Key": value,
              "Content-Type": "application/json",
            },
          });
          if (cfUser.data.success) {
            return true;
          } else {
            return "The API Key is not valid. Make sure your email is also correct";
          }
        } catch (err) {
          return "The API Key is not valid. Make sure your email is also correct";
        }
      },
    },
    {
      type: "input",
      name: "cloudflare_zone_id",
      message: "Please enter your CloudFlare Domain Zone ID?",
      default: async (answers) => {
        try {
          const zoneId = await axios({
            method: "GET",
            url: `https://api.cloudflare.com/client/v4/zones?name=${answers.domain}`,
            headers: {
              "X-Auth-Email": answers.cloudflare_email,
              "X-Auth-Key": answers.cloudflare_global_api,
              "Content-Type": "application/json",
            },
          });
          return zoneId.data.result[0].id || "Error";
        } catch (err) {
          return "Error";
        }
      },
      validate: async (value, answers) => {
        try {
          const dnsRecords = await axios({
            method: "GET",
            url: `https://api.cloudflare.com/client/v4/zones/${value}/dns_records?name=${answers.domain}`,
            headers: {
              "X-Auth-Email": answers.cloudflare_email,
              "X-Auth-Key": answers.cloudflare_global_api,
              "Content-Type": "application/json",
            },
          });

          if (dnsRecords.data.success) {
            let domainExists = false;
            for (const records of dnsRecords.data.result) {
              if (records.name === answers.domain) {
                domainExists = true;
                break;
              }
            }
            if (domainExists) {
              return true;
            } else {
              return "DNS Zone ID not valid";
            }
          }
        } catch (err) {
          return "DNS Zone ID not valid";
        }
      },
    },
    {
      type: "confirm",
      name: "authelia",
      message: "Would you like to protect your apps with a single password? ( Authelia )",
      default: configFile && configFile?.authelia,
    },
    {
      type: "confirm",
      name: "sb_dashboard",
      message: "Would you like to enable Sudobox's Web Dashboard?",
      default: configFile && configFile?.dashboard,
    },
  ]);

  var table = new Table();
  clear();
  await printInfo();

  table.push({ Storage: answers.storage });
  if (answers.storage === "Cloud") table.push({ "Upload Amount": `${answers.storage ? "750GB+" : "Less than 750GB"}` });
  answers.domainConfirm && table.push({ Domain: answers.domain });
  answers.domainConfirm && table.push({ "CloudFlare Email": answers.cloudflare_email });
  answers.domainConfirm && table.push({ "CloudFlare Global API Key": answers.cloudflare_global_api });
  answers.domainConfirm && table.push({ "CloudFlare Zone ID": answers.cloudflare_zone_id });
  table.push({ SSO: answers.authelia ? "Enabled" : "Disabled" });
  table.push({ "Sudobox Dashboard": answers.sb_dashboard ? "Enabled" : "Disabled" });

  console.log(table.toString());
  console.log("");

  const user = await inquirer.prompt([
    {
      type: "confirm",
      name: "infoConfirm",
      message: "Is the information above correct.",
    },
  ]);

  if (!user.infoConfirm) return initQuestions();

  delete answers.uploadAmount;

  let autheliaAnswers;

  clear();
  await printInfo();

  printMessage(
    [
      "Authelia Setup",
      "",
      "These steps are going to help protect your server with Single Sign-On and 2 Factor authentication (recommended).",
      "Authelia is a open source project. Go and check them out here https://www.authelia.com/",
      "For networking we will be utilising Traefik (pronounced traffic) https://traefik.io/",
      "",
      "For step by step guides please go to:",
      "https://docs.sudobox.io/Get-Started/Installation/authelia/",
      "",
    ],
    {
      border: false,
      color: "cyan",
    }
  );

  printMessage(["", "The following credentials will be used for your global sign in", ""], {
    border: false,
    color: "green",
  });

  let passwordsHash = {};

  if (answers.authelia) {
    autheliaAnswers = await inquirer.prompt([
      {
        type: "input",
        name: "auth_username",
        message: "Please enter a username?",
      },
      {
        type: "input",
        name: "auth_password",
        message: "Please enter a password?",
        default: generator.generate({
          length: 32,
          numbers: true,
        }),
      },
    ]);

    clear();
    await printInfo();

    printMessage(
      [
        "Authelia Setup",
        "",
        "The following Containers / Configuration files / Options require passwords to be configured!",
        "",
        "Containers:",
        "Redis, MYSQL",
        "",
        "Configuration files:",
        "configuration.yml",
        "",
        "Options:",
        "JWT Secret, Secret Session, Storage Encryption Key",
        "",
      ],
      {
        border: false,
        color: "cyan",
      }
    );

    const generatePasswordConfirm = await inquirer.prompt([
      {
        type: "confirm",
        name: "generate",
        message: "Would you like to auto-generate these passwords",
      },
    ]);

    if (generatePasswordConfirm.generate) {
      passwordsHash["redispassword"] = generator.generate({
        length: 32,
        numbers: true,
      });

      passwordsHash["mysqlpassword"] = generator.generate({
        length: 32,
        numbers: true,
      });

      passwordsHash["jwtSecret"] = generator.generate({
        length: 32,
        numbers: true,
      });

      passwordsHash["secretsession"] = generator.generate({
        length: 64,
        numbers: true,
      });

      passwordsHash["storageencryptionkey"] = generator.generate({
        length: 64,
        numbers: true,
      });
    } else {
      passwordsHash = await inquirer.prompt([
        {
          type: "input",
          name: "redispassword",
          message: "Please enter a new password for redis?",
          default: generator.generate({
            length: 32,
            numbers: true,
          }),
          validate: async (value) => {
            if (value.length < 12) {
              return "Password must be more then 12 characters";
            } else {
              return true;
            }
          },
        },
        {
          type: "input",
          name: "mysqlpassword",
          message: "Please enter a new password for mysql?",
          default: generator.generate({
            length: 32,
            numbers: true,
          }),
          validate: async (value) => {
            if (value.length < 12) {
              return "Password must be more then 12 characters";
            } else {
              return true;
            }
          },
        },
        {
          type: "input",
          name: "jwtSecret",
          message: "Please enter a new JWT password?",
          default: generator.generate({
            length: 32,
            numbers: true,
          }),
          validate: async (value) => {
            if (value.length < 12) {
              return "Password must be more then 12 characters";
            } else {
              return true;
            }
          },
        },
        {
          type: "input",
          name: "secretsession",
          message: "Please enter a new session password?",
          default: generator.generate({
            length: 64,
            numbers: true,
          }),
          validate: async (value) => {
            if (value.length < 12) {
              return "Password must be more then 12 characters";
            } else {
              return true;
            }
          },
        },
        {
          type: "input",
          name: "storageencryptionkey",
          message: "Please enter a new storage encryption password?",
          default: generator.generate({
            length: 64,
            numbers: true,
          }),
          validate: async (value) => {
            if (value.length >= 20 && value.length <= 64) {
              return true;
            } else {
              return "Password must be more then 12 characters";
            }
          },
        },
      ]);
    }
  }

  let traefikAnswers;

  clear();
  await printInfo();

  console.log("");
  console.log("Traefik Setup");
  console.log("");

  traefikAnswers = await inquirer.prompt([
    {
      type: "input",
      name: "cftoken",
      message: "Please enter your CloudFlare Token!",
      default: configFile && configFile?.cftoken,
    },
  ]);

  const { data: appsToInstall } = await axios({
    method: "POST",
    url: `${process.env.SB_BACKEND}/setup`,
    headers: {
      "Content-Type": "application/json",
    },
    data: JSON.stringify({
      domain: answers.domain,
      cf_email: answers.cloudflare_email,
      cf_api_key: answers.cloudflare_global_api,
      storageType: answers.storage,
      sso: answers.authelia,
      dashboard: answers.sb_dashboard,
    }),
  });

  clear();
  await printInfo();

  console.log("Based on your input, the following apps will be installed.");
  console.log("");
  appsToInstall.results.map((app) => console.log(app));
  console.log("");
  console.log(`Total: ${appsToInstall.results.length}`);
  console.log("");
  const installApps = await inquirer.prompt([
    {
      type: "confirm",
      name: "apps",
      message: "Please confirm if you would like to install the apps listed above?",
    },
  ]);

  if (installApps.apps === false) return process.exit();

  const appsInstalling = {};

  for (const [key, value] of Object.entries(answers)) {
    try {
      const newSetting = Setting({
        name: key,
        value,
      });

      await newSetting.save();
    } catch (err) {
      console.log(err);
    }
  }

  for (const app of appsToInstall.results) {
    clear();
    await printInfo();

    appsInstalling[app] = "Installing...";

    for (const [key, value] of Object.entries(appsInstalling)) {
      console.log(`${key}: ${value}`);
    }

    const installedApp = await installApp(app, answers, autheliaAnswers, traefikAnswers, passwordsHash);

    if (!installedApp) {
      appsInstalling[app] = "Successfully Installed";
    } else {
      appsInstalling[app] = "Installation Failed";
    }
  }

  clear();
  await printInfo();
  console.log("");
  console.log("Please make a note of the following passwords!");
  console.log("");
  console.log("Authelia Password: " + autheliaAnswers.auth_password);
  console.log("Redis Password: " + passwordsHash.redispassword);
  console.log("MSQL Password: " + passwordsHash.mysqlpassword);
  console.log("JWT Password: " + passwordsHash.jwtSecret);
  console.log("Secret Session Password: " + passwordsHash.secretsession);
  console.log("Storage Encryption Key: " + passwordsHash.storageencryptionkey);
  console.log("");

  const continueToCLI = await inquirer.prompt([
    {
      type: "input",
      name: "continue",
      message: "When you are finished. Please press any key to continue",
    },
  ]);
};

const installApp = async (app, answers, autheliaAnswers, traefikAnswers, passwordsHash) => {
  return new Promise(async (resolve, reject) => {
    try {
      const installedApp = await axios({
        method: "POST",
        url: `${process.env.SB_BACKEND}/setup/${app}`,
        headers: { "Content-Type": "Application/json" },
        data: JSON.stringify({
          domain: answers.domain || "",
          cftoken: traefikAnswers.cftoken || "",
          redispassword: passwordsHash.redispassword || "",
          mysqlpassword: passwordsHash.mysqlpassword || "",
          storageencryptionkey: passwordsHash.storageencryptionkey || "",
          jwtSecret: passwordsHash.jwtSecret || "",
          secretsession: passwordsHash.secretsession || "",
          email: answers.cloudflare_email || "",
          username: autheliaAnswers.auth_username || "",
          password: autheliaAnswers.auth_password || "",
          sso: answers.authelia || "",
        }),
      });
      resolve(installedApp.data.error);
    } catch (err) {
      console.log(err);
      reject(false);
    }
  });
};
