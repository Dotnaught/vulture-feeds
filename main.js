"use strict";
const electron = require("electron");
const url = require("url");
const path = require("path");
const getUrls = require("get-urls"); //for finding original URLs in Reddit posts
//const assert = require("assert");
const FeedParser = require("feedparser");
const request = require("request"); // for fetching the feed
const crypto = require("crypto");
const rootCas = require("ssl-root-cas/latest").create();

require("https").globalAgent.options.ca = rootCas;

const moment = require("moment");
moment().format();

const Store = require("electron-store");
const store = new Store();
let defaultTime = 1440;
let setTime = store.get("savedTime", defaultTime);

const cheerio = require("cheerio");

const { app, BrowserWindow, Menu, ipcMain, dialog } = electron;
const { parse } = require("tldjs"); //for parsing domain names

//set ENV production or development
process.env.NODE_ENV = "production";
//set debug flag
process.env.DEBUG = "electron-builder";

const log = require("electron-log");
//~/Library/Logs/vulture-feeds/log.log

const { autoUpdater } = require("electron-updater");
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";
log.info("App starting...");

//const dialog = electron.dialog
//let repoList = [{ owner: "octokit", repo: "rest.js" }];

const fs = require("fs");

const Octokit = require("@octokit/rest");
const octokit = new Octokit({
  // see "Authentication" section below
  auth: undefined,

  // setting a user agent is required: https://developer.github.com/v3/#user-agent-required
  // v1.2.3 will be current @octokit/rest version
  userAgent: "octokit/rest.js v1.2.3",

  // add list of previews you’d like to enable globally,
  // see https://developer.github.com/v3/previews/.
  // Example: ['jean-grey-preview', 'symmetra-preview']
  previews: [],

  // set custom URL for on-premise GitHub Enterprise installations
  baseUrl: "https://api.github.com",

  // pass custom methods for debug, info, warn and error
  log: {
    debug: () => {},
    info: () => {},
    warn: console.warn,
    error: console.error
  },

  request: {
    // Node.js only: advanced request options can be passed as http(s) agent,
    // such as custom SSL certificate or proxy settings.
    // See https://nodejs.org/api/http.html#http_class_http_agent
    agent: false,

    // request timeout in ms. 0 means no timeout
    timeout: 0
  }
});

//iterate over list of repos
//iterate over list of open issues
//compare comment count to last comment count
//if a baseline exists and new value is significantly greater, surface issue thread
//else update baseline

//declare windows
let mainWindow;
let addWindow;
let feedWindow;
let pageWindow;
let addWatchPageWindow;
let repoWindow;

global.showFeedsList = {
  defaultFeedsList: []
};
global.fdb = {
  db: []
};
global.pdb = {
  db: []
};
global.masterList = {
  db: []
};

global.activeRequest = { status: "inactive" };

global.timeWindow = { minutes: setTime }; //24hours * 60 minutes, default on mainWindow.html

// SSL/TSL: this is the self signed certificate support
app.on(
  "certificate-error",
  (event, webContents, url, error, certificate, callback) => {
    // On certificate error we disable default behaviour (stop loading the page)
    // and we then say "it is all fine - true" to the callback
    event.preventDefault();
    console.log("certificate error");
    callback(true);
  }
);

//Listen for the app to be ready
app.on("ready", function() {
  const { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;

  //create new window
  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    webPreferences: {
      nodeIntegration: true
    }
  });

  mainWindow.on("focus", () => {
    //console.log("Restore tab position");
    mainWindow.webContents.send("focus");
  });
  mainWindow.on("blur", () => {
    //console.log("Save tab position");
    mainWindow.webContents.send("blur");
  });
  //load html
  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "html/mainWindow.html"),
      protocol: "file:",
      slashes: true
    })
  );
  //quit app when closed
  mainWindow.on("closed", function() {
    console.log("Quitting...");
    app.quit();
  });

  //build menu from template
  const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
  //insert menu
  Menu.setApplicationMenu(mainMenu);
  //check for updates
  if (process.env.NODE_ENV !== "development") {
    autoUpdater.checkForUpdates();
  } else {
    console.log(process.env.NODE_ENV);
  }
});

autoUpdater.on("update-not-available", () => {
  console.log("update-not-available");
  //mainWindow.webContents.send('updateReady')
});
//https://github.com/electron-userland/electron-builder/blob/master/docs/encapsulated%20manual%20update%20via%20menu.js
// when the update has been downloaded and is ready to be installed, notify the BrowserWindow
autoUpdater.on("update-downloaded", () => {
  console.log("updateReady");
  mainWindow.webContents.send("updateReady");
});

// when receiving a quitAndInstall signal, quit and install the new version ;)
ipcMain.on("quitAndInstall", () => {
  console.log("quitAndInstall");
  autoUpdater.quitAndInstall();
});

function exportDB() {
  console.log("Starting export...");

  dialog
    .showSaveDialog(mainWindow, {
      properties: ["openFile", "openDirectory"],
      filters: [{ name: "JSON", extensions: ["json"] }],
      buttonLabel: "Export Feeds",
      defaultPath: app.getPath("downloads") + "/vulture-feeds-data.json"
    })
    .then(result => {
      console.log(result.canceled);
      console.log(result.filePath);
      if (result.filePath === undefined || result.canceled) {
        console.log("No file path defined or cancelled");
        return;
      }
      if (fs.existsSync(result.filePath)) {
        dialog.showMessageBox(
          {
            type: "info",
            buttons: ["Yes", "No"],
            message: "Are you sure you want to overwrite this file?"
          },
          resp => {
            if (resp === 0) {
              console.log("Exists");
              mainWindow.webContents.send("export", result.filePath);
            }
          }
        );
      } else {
        console.log("File doesn't yet exist");
        mainWindow.webContents.send("export", result.filePath);
      }
    })
    .catch(err => {
      console.log(err);
    });
}

function importDB() {
  dialog
    .showOpenDialog(mainWindow, {
      properties: ["openFile", "openDirectory"],
      filters: [{ name: "JSON", extensions: ["json"] }],
      defaultPath: app.getPath("downloads") + "/vulture-feeds-data.json"
    })
    .then(result => {
      console.log(result.canceled);
      console.log(result.filePath);
      console.log(result.filePaths);
      if (
        result.filePaths === undefined ||
        !fs.existsSync(result.filePaths[0] || result.canceled)
      ) {
        console.log("No file found");
        return;
      } else {
        let importFile = result.filePaths[0];
        mainWindow.webContents.send("import", importFile);
      }
    })
    .catch(err => {
      console.log(err);
    });
}

//handle createAddWindow
function createAddWindow() {
  let { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;
  addWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true
    },
    width: width / 2,
    height: height / 2,
    title: "Add News List Item"
  });
  //load html
  addWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "/html/addWindow.html"),
      protocol: "file:",
      slashes: true
    })
  );
  //garbage collection
  addWindow.on("close", function() {
    addWindow = null;
  });
}

//handle createAddWatchPage
function createAddWatchPageWindow() {
  let { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;
  addWatchPageWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true
    },
    width: width / 2,
    height: height / 2,
    title: "Add URL"
  });
  //load html
  addWatchPageWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "/html/addWatchPage.html"),
      protocol: "file:",
      slashes: true
    })
  );
  //garbage collection
  addWatchPageWindow.on("close", function() {
    //addWatchPageWindow = null;
  });
}

//handle createAddRepo
function createAddRepoWindow() {
  let { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;
  repoWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true
    },
    width: width / 2,
    height: height / 2,
    title: "Add URL"
  });
  //load html
  repoWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "/html/addRepo.html"),
      protocol: "file:",
      slashes: true
    })
  );
  //garbage collection
  repoWindow.on("close", function() {
    addWatchPageWindow = null;
  });
}

//handle createFeedWindow
function createFeedWindow() {
  let { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;
  feedWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true
    },
    width: width / 2,
    height: height / 2,
    title: "Feed List"
  });
  //load html
  feedWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "/html/feedWindow.html"),
      protocol: "file:",
      slashes: true
    })
  );
  //garbage collection
  feedWindow.on("close", function() {
    feedWindow = null;
  });
}

//handle createPageWindow
function createPageWindow() {
  let { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;
  pageWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true
    },
    width: width / 2,
    height: height / 2,
    title: "Page List"
  });
  //load html
  pageWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "/html/pageWindow.html"),
      protocol: "file:",
      slashes: true
    })
  );
  //garbage collection
  pageWindow.on("close", function() {
    pageWindow = null;
  });
}

//triggered from ipcRenderer in addRepo.js
ipcMain.on("item:addRepo", function(e, repoURL, keywords) {
  if (repoURL) {
    let hash = 0;
    let linkHash = keywords; //passkeywords via this unused variable
    let mode = "repo";
    mainWindow.webContents.send(
      "item:addRepo",
      repoURL,
      hash,
      linkHash,
      mode,
      Date.now()
    );
  } else {
    mainWindow.webContents.executeJavaScript(
      "alert('That repo does not work.');"
    );
  }
  repoWindow.close();
});

//triggered from ipcRenderer in addWindow.js
ipcMain.on("item:addFeed", function(e, item, filter) {
  let obj = parse(item);

  if (obj.isValid && obj.tldExists && obj.domain) {
    mainWindow.webContents.send("item:addFeed", item, filter);
  } else {
    console.log("Not working");
    mainWindow.webContents.executeJavaScript(
      "alert('That feed does not work.');"
    );
  }

  addWindow.close();
});

ipcMain.on("item:addPage", function(e, page, mode) {
  //console.log('Received ' + page + ' ' + mode); //diff, links, both
  let obj = parse(page);
  let options = {
    url: page,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.84 Safari/537.36",
      "Content-Type": "application/x-www-form-urlencoded"
    }
  };
  if (obj.isValid && obj.tldExists && obj.domain) {
    request(options, function initialRequestCallback(error, response, body) {
      // TODO: DO SOMETHING MEANINGFUL WITH THE ERROR
      if (error) {
        return console.error(error);
      } else {
        console.log(response.statusCode, response.statusMessage);
        if (response.statusCode > 399) {
          console.log("Status code " + response.statusCode);
        } else {
          //

          const $ = cheerio.load(body);
          let links = $("a"); //jquery get all hyperlinks //&& $(link).attr('href').startsWith('http')
          let blob = "";
          $(links).each(function(i, link) {
            if ($(link).attr("href")) {
              //console.log('cheerio: ' + $(link).attr('href'));
              blob += $(link).attr("href");
            }
          });

          let linkHash = crypto
            .createHash("sha1")
            .update(blob)
            .digest("hex");
          //console.log("blob: \n" + blob);
          //console.log(linkHash);

          //console.log(`Seeding hash for ${page}.`)

          let hash = crypto
            .createHash("sha1")
            .update(body)
            .digest("hex");

          //store hash in db
          mainWindow.webContents.send(
            "item:addPage",
            page,
            hash,
            linkHash,
            mode,
            Date.now()
          );
        } // end else
      } // end else
    }); // end request
  } else {
    console.log("Not working");
    mainWindow.webContents.executeJavaScript(
      "alert('That feed does not work.');"
    );
  }
  //mainWindow.webContents.send('item:addPage', page);
  addWatchPageWindow.close();
});

ipcMain.on("reload:mainWindow", function() {
  console.log("reload");
  global.masterList.db = [];
  mainWindow.webContents.reloadIgnoringCache();
});

//
function getRepo(pageObj) {
  //console.log('getRepo');

  //request
  let owner = pageObj.url
    .split("/")
    .slice(-2, -1)
    .join("/");
  let repo = pageObj.url
    .split("/")
    .slice(-1)
    .join("/");

  //console.log(owner, repo);
  //octokit.issues.listCommentsForRepo({owner, repo, sort, direction, since}).then(result => {})
  let now = moment();
  let backthen = now.subtract(30, "days").toISOString();

  //octokit.issues.listCommentsForRepo({
  octokit.issues
    .listForRepo({
      owner: owner,
      repo: repo,
      since: backthen
    })
    .then(({ data }) => {
      // handle data
      //console.log(data)

      for (var i = 0; i < data.length; i++) {
        //console.log(data[i].comments)
        //linkhash, used for watched pages, is used here to store keywords
        let keywords =
          typeof pageObj.linkHash == "string" && pageObj.linkHash.length > 0
            ? pageObj.linkHash.toLowerCase().split(" ")
            : false;
        let string = data[i].body.toLowerCase();
        let found =
          typeof keywords != "object"
            ? keywords
            : keywords.some(el => string.includes(el));
        let pullRequest =
          typeof data[i].pull_request == "object" ? true : false; //just get comments, not PRs
        //console.log('keywords: ' + keywords + '\nstring: ' + string)
        if (
          (keywords && found && !pullRequest) ||
          (!keywords && !pullRequest)
        ) {
          //console.log(data[i].pull_request)
          //update db.pages
          //spoof rss feed object to reuse table code
          let now = moment();
          let item = {};
          let published = data[i].updated_at; //now
          item.published = now.diff(published, "minutes"); // for sorting
          item.hoursAgo = moment(published).fromNow(); // for display, issue last updated
          if (item.hoursAgo > now) {
            item.hoursAgo = now;
          }
          item.revisedLink = data[i].html_url;
          item.sourceLink = pageObj.url; //github
          item.key = crypto
            .createHash("sha1")
            .update(item.revisedLink)
            .digest("hex");
          //console.log(item.revisedLink, item.key);

          item.title = `[${data[i].comments} comments] `;
          item.title += data[i].title.replace(/[^a-zA-Z 0-9]+/g, "");
          //unique to pages, add to table code
          item.lastChecked = moment(pageObj.timeChecked).fromNow();
          //item.changedText = ' keywords found.' -- not used for repos to preserve formatting

          //add watched page info to table
          mainWindow.webContents.send("item:add", item);
          //no need to update db since there's been no change
        }
      }

      //mainWindow.webContents.send('item:addRepo', repo, owner, foundList)
    })
    .catch(e => console.log(e));
  //end
}
//

function checkHashAndMode(newHash, oldHash, newLinkHash, oldLinkHash, mode) {
  if (mode === "diff") {
    return newHash != oldHash;
  } else {
    return newLinkHash != oldLinkHash;
  }
}

//check if watched page has changed
function getPage(pageObj) {
  //console.log('getpage');
  let options = {
    url: pageObj.url,
    //protocol: "https:",
    //port: 443,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.100 Safari/537.36",
      "Content-Type": "application/x-www-form-urlencoded"
    }
  };
  request(options, function initialRequestCallback(error, response, body) {
    //more error info?
    if (error) {
      return console.error(error);
    } else {
      console.log(response.statusCode, response.statusMessage);
      if (response.statusCode > 399) {
        console.log("status code " + response.statusCode);
      } else {
        console.log(`Checking hash for ${pageObj.url}.`);
        //
        const $ = cheerio.load(body);
        let links = $("a"); //jquery get all hyperlinks //&& $(link).attr('href').startsWith('http')
        let blob = "";
        $(links).each(function(i, link) {
          if (
            $(link).attr("href") &&
            $(link)
              .attr("href")
              .startsWith("http")
          ) {
            /* let linkParsed = parse($(link).attr("href"));
            let pageParsed = parse(options.url);

            let match =
              linkParsed.domain == pageParsed.domain ? "true" : "false";
            console.log(pageParsed.domain + " and link matched: " + match);
            console.log("linkParsed: " + linkParsed.domain);
            console.log("pageParsed: " + pageParsed.domain);
            console.log("cheerio: " + $(link).attr("href"));
            console.log("source site: " + options.url); */

            blob += $(link).attr("href");
          }
        });

        let currentLinkHash = crypto
          .createHash("sha1")
          .update(blob)
          .digest("hex");

        let currentHash = crypto
          .createHash("sha1")
          .update(body)
          .digest("hex");

        if (
          checkHashAndMode(
            currentHash,
            pageObj.hash,
            currentLinkHash,
            pageObj.linkHash,
            pageObj.mode
          )
        ) {
          //if (currentHash != pageObj.hash && currentLinkHash != pageObj.linkHash){
          console.log(pageObj.url + " has changed!");

          //update db.pages
          //spoof rss feed object to reuse table code
          let now = moment();
          let item = {};
          let published = now;
          item.published = now.diff(published, "minutes"); // for sorting
          item.hoursAgo = moment(published).fromNow(); // for display
          item.revisedLink = pageObj.url;
          item.sourceLink = pageObj.url;
          item.key = crypto
            .createHash("sha1")
            .update(item.revisedLink)
            .digest("hex");

          if (typeof item.key != "string") {
            console.log("***", item.revisedLink);
          }

          item.title = "> ";
          if (body.match(/<title[^>]*>([^<]+)<\/title>/) !== null) {
            item.title += body.match(/<title[^>]*>([^<]+)<\/title>/)[1];
            item.title = item.title.replace(/&#039;/g, "'");
            //console.log(item.title);
          } else {
            item.title += pageObj.url;
          }
          //unique to pages, add to table code
          item.lastChecked = moment(pageObj.timeChecked).fromNow();
          item.changedText = " has changed since " + item.lastChecked;

          //add watched page info to table
          mainWindow.webContents.send("item:add", item);
          //update db.pages
          //use Date.now() for db, moment for display
          mainWindow.webContents.send(
            "item:updatePage",
            pageObj.url,
            currentHash,
            currentLinkHash,
            Date.now()
          );
        } else {
          console.log(pageObj.url + " unchanged");

          //update db.pages
          //spoof rss feed object to reuse table code
          let now = moment();
          let item = {};
          let published = now;
          item.published = now.diff(published, "minutes"); // for sorting
          item.hoursAgo = moment(published).fromNow(); // for display
          if (item.hoursAgo > now) {
            item.hoursAgo = now;
          }
          item.revisedLink = pageObj.url;
          item.sourceLink = pageObj.url;
          item.key = crypto
            .createHash("sha1")
            .update(item.revisedLink)
            .digest("hex");

          if (typeof item.key != "string") {
            console.log("***", item.revisedLink);
          }

          item.title = "> ";
          if (body.match(/<title[^>]*>([^<]+)<\/title>/) !== null) {
            item.title += body.match(/<title[^>]*>([^<]+)<\/title>/)[1];
            item.title = item.title.replace(/&#039;/g, "'");
            console.log(item.title);
          } else {
            item.title += pageObj.url;
          }
          //unique to pages, add to table code
          item.lastChecked = moment(pageObj.timeChecked).fromNow();
          item.changedText = " unchanged since " + item.lastChecked;

          //add watched page info to table
          mainWindow.webContents.send("item:add", item);
          //no need to update db since there's been no change
        }
      } // end else
    } // end else
  }); // end request
}

function isHTML(str) {
  if (str) {
    let arrNames = str.split(",");

    if (arrNames.length > 0) {
      //console.log("arrNames", arrNames);
      let rebuiltString = "";
      arrNames.forEach(element => {
        rebuiltString += element.replace(/<(.|\n)*?>/g, "");
        rebuiltString += ", ";
      });
      rebuiltString = rebuiltString.replace(/,\s*$/, "");
      //item = item.replace(/<(.|\n)*?>/g, '');
      return rebuiltString;
    } else {
      // /<[a-z/][\s\S]*>/i.test(str) || str.indexOf('@') !== -1 || str.indexOf(' ') === -1
      //hacky way to filter for two word+ author names
      return str;
    }
  } else {
    //null case
    return "No author data";
  }
}

//fetch feeds
function getFeed(theFeed, timeWindow, flist, callback) {
  const options = {
    url: theFeed,
    method: "GET",
    //protocol: "https:",
    //port: 443,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.84 Safari/537.36",
      Connection: "keep-alive"
    },
    timeout: 20000
  };
  const req = request(options);
  //const req = request(theFeed)
  const feedparser = new FeedParser();

  req.on("error", function(error) {
    // handle any request errors
    console.log(">error: " + error + " fetching " + theFeed);
    callback(error);

    //mainWindow.webContents.send('item:removeFeed', theFeed);
  });

  req.on("response", function(res) {
    var stream = this; // `this` is `req`, which is a stream

    if (res.statusCode !== 200) {
      this.emit("error", new Error("Bad status code!"));
      console.log("status code " + res.statusCode);
      mainWindow.webContents.send("item:removeFeed", theFeed);
      //return this.emit('error', new Error('Bad status code'))
    } else {
      stream.pipe(feedparser);
    }
  });

  feedparser.on("error", function(error) {
    // always handle errors
    mainWindow.webContents.send("update", "Search");
    console.log(error, error.stack);
    console.log("error here " + theFeed);
    callback(error);

    //process.exit(1);
    this.emit("end", error);
  });

  feedparser.on("readable", function() {
    // This is where the feeds get processed
    let stream = this; // `this` is `feedparser`, which is a stream
    let meta = this.meta; // **NOTE** the 'meta' is always available in the context of the feedparser instance
    let item;
    let now = moment(); //now

    while ((item = stream.read())) {
      //console.log(item.author.split(','));
      //if (!isHTML(item.author)) {
      //	item.foundAuthor = item.author
      //}
      item.foundAuthor = isHTML(item.author);

      item.revisedLink = item.link;
      item.sourceLink = theFeed;
      item.filterList = flist;
      //console.log(item.filterList)
      //console.log(item.revisedLink)
      if (!item.description) {
        item.description = "No description";
      }
      let altURLs = [...getUrls(item.description)]; //set to array

      //reddit sets are size 3
      if (
        altURLs.length === 3 &&
        meta.title === "newest submissions : technology"
      ) {
        item.revisedLink = altURLs[1];
        item.viaLink = item.link;
        item.viaTitle = "Reddit";
      } else if (meta.title === "Techmeme") {
        if (!altURLs[0].includes("techmeme")) {
          item.revisedLink = altURLs[0];
          item.viaLink = item.link;
          item.viaTitle = meta.title;
        } else {
          item.revisedLink = altURLs[altURLs.length - 1];
          item.viaLink = item.link;
          item.viaTitle = meta.title;
        }
      } else if (meta.title === "Hacker News") {
        item.viaLink = altURLs[0];
        item.viaTitle = meta.title;
      } else if (meta.title === "Hacker News: Newest") {
        item.viaLink = altURLs[2]; //https://hnrss.org/newest API differs from Hacker News RSS
        item.viaTitle = "Hacker News+";
      } else if (meta.title === "Technology - Google News") {
        item.viaLink = altURLs[altURLs.length - 1];
        item.viaTitle = "Google News";
      } else if (meta.title === "Articles and Investigations - ProPublica") {
        item.revisedLink = meta.link;
      } else if (meta.title === "Lobsters") {
        item.viaLink = altURLs[0];
        item.viaTitle = "Lobste.rs";
      }

      if (typeof item.revisedLink != "string") {
        console.log("Huh:", item.revisedLink);
      }

      item.key = crypto
        .createHash("sha1")
        .update(item.revisedLink)
        .digest("hex");

      if (typeof item.key != "string") {
        console.log("***", item.revisedLink);
      }

      let published = item.pubDate || meta.pubDate || Date.now();

      item.published = now.diff(published, "minutes"); //use for sorting
      let hoursAgo = moment(published).fromNow();
      item.hoursAgo = hoursAgo;

      //filter here
      //list stories 12 hours old or less
      if (parseInt(item.published) <= timeWindow) {
        //send each article object to mainWindow
        //console.log(item);
        global.masterList.db.push(item);
        //mainWindow.webContents.send("item:add", item);
      }
    }
  });

  feedparser.on("end", () => {
    //console.log("End parsing " + theFeed);
    callback();
  });
  //end request
}
//exports.test = () => console.log('Export works correctly');
// Make method externaly visible
exports.processFeeds = arg => {
  if (global.activeRequest.status === "active") {
    console.log("Request blocked", global.activeRequest.status);
    return;
  }
  console.log("Executing request");
  global.showFeedsList.defaultFeedsList = [];
  global.masterList.db = [];
  let counter = 0;
  if (arg.length > 37) {
    console.log("Length: " + arg.length);
  }
  for (var i = 0; i < arg.length; i++) {
    if (i === 0) {
      console.log("Request-> active");
      global.activeRequest.status = "active";
    }
    //add rssLink to array
    global.showFeedsList.defaultFeedsList.push(arg[i].rssLink);

    let flist = "";
    if (arg[i].filterList && arg[i].filterList.length > 0) {
      flist = arg[i].filterList;
    }

    if (arg[i].visible) {
      //TODO: check if online: https://www.npmjs.com/package/is-online
      //get articles from rss feed
      getFeed(arg[i].rssLink, global.timeWindow.minutes, flist, function() {
        counter++;
        if (arg.length <= counter) {
          global.activeRequest.status = "inactive";
          console.log("Request->", global.activeRequest.status);
          mainWindow.webContents.send("update", "Search");
          mainWindow.webContents.send("stop", true);
          //console.log(`Finished: ${counter} out of ${arg.length} feeds`);
          //revised sort
          global.masterList.db.sort(function(a, b) {
            return a.published - b.published;
          });
          //deplicate global.masterList.db
          let arr = global.masterList.db;

          const result = [];
          const map = new Map();
          for (const item of arr) {
            if (!map.has(item.key)) {
              map.set(item.key, true); // set any value to Map
              result.push(item);
            }
          }
          //add fetched feed items to table
          for (var i = 0; i < result.length; i++) {
            mainWindow.webContents.send("item:add", result[i]);
          }
          global.masterList.db = [];
        } else {
          let m = counter + " out of " + arg.length + " feeds";
          //console.log(m);

          mainWindow.webContents.send("update", m);
        }
      }); //end getFeed
    } else {
      counter++;
      console.log(arg[i].rssLink + " not visible");
    }
  }
};

exports.processPages = arg => {
  for (var i = 0; i < arg.length; i++) {
    //console.log(arg[i]);
    if (arg[i].mode === "repo" && arg[i].visible) {
      getRepo(arg[i]);
    } else if (arg[i].visible) {
      getPage(arg[i]);
    }
  }
};

//create menu template
const mainMenuTemplate = [
  //file menu
  {
    label: "File",
    submenu: [
      {
        label: "Add Feed",
        accelerator: "CmdOrCtrl+D",
        click() {
          createAddWindow();
        }
      },
      {
        label: "Add Watched Page",
        accelerator: "CmdOrCtrl+W",
        click() {
          createAddWatchPageWindow();
        }
      },
      {
        label: "Add Repo",
        accelerator: "CmdOrCtrl+E",
        click() {
          createAddRepoWindow();
        }
      },
      {
        label: "Add Author",
        accelerator: "CmdOrCtrl+W",
        click() {
          mainWindow.webContents.send("addAuthor");
        }
      },
      {
        label: "Reload",
        accelerator: "CmdOrCtrl+R",
        click() {
          console.log("reload");

          if (global.activeRequest.status === "inactive") {
            global.masterList.db = [];
            console.log(global.masterList.db.length);
            mainWindow.reload();
          } else {
            console.log("Request in progress");
          }
        }
      },

      { type: "separator" },
      {
        label: "Show Feeds",
        accelerator: "CmdOrCtrl+F",
        click() {
          createFeedWindow();
          //mainWindow.webContents.send('item:list');
        }
      },
      {
        label: "Show Watched Pages/Repos",
        accelerator: "CmdOrCtrl+P",
        click() {
          createPageWindow();
        }
      },
      { type: "separator" },
      {
        label: "Load Defaults",
        accelerator: "CmdOrCtrl+L",
        click() {
          mainWindow.webContents.send("defaults");
        }
      },
      {
        label: "Import Feeds",
        accelerator: "CmdOrCtrl+M",
        click() {
          importDB();
          //mainWindow.webContents.send('import');
        }
      },
      {
        label: "Export Feeds",
        accelerator: "CmdOrCtrl+T",
        click() {
          exportDB();
          //mainWindow.webContents.send('export', dirpath);
        }
      },
      {
        label: "Delete Database",
        click() {
          mainWindow.webContents.send("item:dbclear");
        }
      },
      { type: "separator" },
      {
        label: "Quit",
        accelerator: "CmdOrCtrl+Q",
        click() {
          app.quit();
        }
      }
    ]
  },
  //edit menu
  {
    label: "Edit",
    submenu: [
      { label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
      { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
      { type: "separator" },
      { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
      { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
      { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
      {
        label: "Select All",
        accelerator: "CmdOrCtrl+A",
        selector: "selectAll:"
      },
      {
        label: "Toggle Dev Tools",
        accelerator: "CmdOrCtrl+I",
        click(item, focusedWindow) {
          //check for focusedWindow, macOS Color Picker not part of DOM
          if (focusedWindow) {
            focusedWindow.toggleDevTools();
          }
        }
      }
    ]
  },
  //window menu
  {
    role: "window",
    submenu: [
      {
        role: "minimize"
      },
      {
        role: "close"
      }
    ]
  },
  //help menu
  {
    role: "help",
    submenu: [
      {
        label: "Learn More",
        click() {
          require("electron").shell.openExternal("https://electron.atom.io");
        }
      }
    ]
  }
];

//if mac ad empty object to menu
if (process.platform === "darwin") {
  const name = app.getName();

  app.setAboutPanelOptions({
    applicationName: app.getName(),
    applicationVersion: app.getVersion(),
    copyright: "Released under the MIT license",
    credits: "Thomas Claburn, Lot 49 Labs"
  });

  mainMenuTemplate.unshift({
    label: name,
    submenu: [
      {
        role: "about"
      },
      {
        type: "separator"
      },
      {
        role: "services",
        submenu: []
      },
      {
        type: "separator"
      },
      {
        role: "hide"
      },
      {
        role: "hideothers"
      },
      {
        role: "unhide"
      },
      {
        type: "separator"
      },
      {
        role: "quit"
      }
    ]
  });
  // Edit menu.
  mainMenuTemplate[2].submenu.push(
    {
      type: "separator"
    },
    {
      label: "Speech",
      submenu: [
        {
          role: "startspeaking"
        },
        {
          role: "stopspeaking"
        }
      ]
    }
  );
  // Window menu.
  mainMenuTemplate[3].submenu = [
    {
      label: "Close",
      accelerator: "CmdOrCtrl+W",
      role: "close"
    },
    {
      label: "Minimize",
      accelerator: "CmdOrCtrl+M",
      role: "minimize"
    },
    {
      role: "zoomin"
    },
    {
      role: "zoomout"
    },
    {
      role: "resetzoom"
    },
    {
      type: "separator"
    },
    {
      label: "Bring All to Front",
      role: "front"
    }
  ];
}
/*
//add dev tools item if not in production
if(process.env.NODE_ENV !== 'production'){
    mainMenuTemplate.push({
        label: 'Developer Tools',
        submenu: [
            {
                label: 'Toggle Dev Tools',
                accelerator: 'CmdOrCtrl+I',
                click(item, focusedWindow){
                    //check for focusedWindow, macOS Color Picker not part of DOM
                    if (focusedWindow){
                        focusedWindow.toggleDevTools()
                    }
                }
            }
        ]
    })
}

*/
