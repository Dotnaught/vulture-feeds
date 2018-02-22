const electron = require('electron');
const url = require('url');
const path = require('path');
const getUrls = require('get-urls'); //for finding original URLs in Reddit posts
const assert = require('assert');
const FeedParser = require('feedparser');
const request = require('request'); // for fetching the feed
const checksum = require('checksum');
const moment = require('moment');
moment().format();

const Config = require('electron-config');
const config = new Config();
let defaultTime = 1440; 
let setTime = config.get('savedTime', defaultTime);

const cheerio = require('cheerio');

const {app, BrowserWindow, Menu, ipcMain} = electron;
const { parse} = require('tldjs'); //for parsing domain names

//set ENV production or development
process.env.NODE_ENV = 'development';

const dialog = electron.dialog;

const fs = require("fs");




//declare windows
let mainWindow; 
let addWindow;
let feedWindow;
let addWatchPageWindow

global.showFeedsList = {
	defaultFeedsList : []
	}
global.fdb = {
	db : []
}
global.pdb = {
	db : []
}

global.timeWindow = {minutes : setTime}; //24hours * 60 minutes, default on mainWindow.html


//Listen for the app to be ready
app.on ('ready', function(){
	const {width, height} = electron.screen.getPrimaryDisplay().workAreaSize

	//create new window
	mainWindow = new BrowserWindow({width, height});
	//load html
	mainWindow.loadURL(url.format({
		pathname: path.join(__dirname, 'html/mainWindow.html'),
		protocol: 'file:',
		slashes: true
	}));
	//quit app when closed
	mainWindow.on('closed', function(){
		app.quit();
	});

	//build menu from template
	const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
	//insert menu
	Menu.setApplicationMenu(mainMenu);
	
});

function exportDB() {
  dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    buttonLabel: 'Export the file \'vfdb.json\'',
    filters: [{name: 'JSON', extensions: ['json']}],
  }, function (filepath){
  	if (filepath === undefined) return;
  	
  	let fullpath = filepath + '/vfdb.json'
  	if (fs.lstatSync(fullpath).isFile()) {
  		
  		dialog.showMessageBox({
                type: 'info',
                buttons: ['Yes', 'No'],
                message: 'Are you sure you want to overwrite \'vfdb.json\'?',
            }, (resp) => {
                if (resp === 0) {
                    mainWindow.webContents.send('export', filepath);
                }
            });

  	} else {
  		mainWindow.webContents.send('export', filepath);
  	}
  	
  })
}

function importDB(){
	dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'openFile'],
    buttonLabel: 'Select the file \'vfdb.json\'',
    filters: [{name: 'JSON', extensions: ['json']}]
  }, function (filepath){
  	//todo show error dialog
  	if (!fs.lstatSync(filepath[0]).isFile() || filepath[0].indexOf('vfdb.json') === -1) return;
  	
  	let importFile = filepath[0];
  	mainWindow.webContents.send('import', importFile);
  	//[ '/Users/tk/tk' ]
  })
}

//handle createAddWindow
function createAddWindow(){
	addWindow = new BrowserWindow({
		width: 300,
		height: 200,
		title: 'Add News List Item'
	});
	//load html
	addWindow.loadURL(url.format({
		pathname: path.join(__dirname, '/html/addWindow.html'),
		protocol: 'file:',
		slashes: true
	}));
	//garbage collection
	addWindow.on('close', function(){
		addWindow = null;
	});
}

//handle createAddWatchPage
function createAddWatchPageWindow(){
	addWatchPageWindow = new BrowserWindow({
		width: 300,
		height: 300,
		title: 'Add URL'
	});
	//load html
	addWatchPageWindow.loadURL(url.format({
		pathname: path.join(__dirname, '/html/addWatchPage.html'),
		protocol: 'file:',
		slashes: true
	}));
	//garbage collection
	addWatchPageWindow.on('close', function(){
		addWatchPageWindow = null;
	});
}

//handle createFeedWindow
function createFeedWindow(){
	feedWindow = new BrowserWindow({
		width: 400,
		height: 400,
		title: 'Feed List'
	});
	//load html
	feedWindow.loadURL(url.format({
		pathname: path.join(__dirname, '/html/feedWindow.html'),
		protocol: 'file:',
		slashes: true
	}));
	//garbage collection
	feedWindow.on('close', function(){
		feedWindow = null;
	});
}

//handle createPageWindow
function createPageWindow(){
	pageWindow = new BrowserWindow({
		width: 400,
		height: 400,
		title: 'Page List'
	});
	//load html
	pageWindow.loadURL(url.format({
		pathname: path.join(__dirname, '/html/pageWindow.html'),
		protocol: 'file:',
		slashes: true
	}));
	//garbage collection
	pageWindow.on('close', function(){
		pageWindow = null;
	});
}

//triggered from ipcRenderer in addWindow
ipcMain.on('item:addFeed', function(e, item){
	let obj = parse(item);

	if (obj.isValid && obj.tldExists && obj.domain){
		mainWindow.webContents.send('item:addFeed', item);
	} else {
		console.log("Not working");
		mainWindow.webContents.executeJavaScript("alert('That feed does not work.');");
	}
	
	addWindow.close();
});

ipcMain.on('item:addPage', function(e, page, mode){
	//console.log('Received ' + page + ' ' + mode); //diff, links, both
	let obj = parse(page);
	let options = {
		url: page,
  		headers: {
    			'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.84 Safari/537.36',
    			'Content-Type':'application/x-www-form-urlencoded'
  				}
	};
	if (obj.isValid && obj.tldExists && obj.domain){
		request(options, function initialRequestCallback(error, response, body){

				// TODO: DO SOMETHING MEANINGFUL WITH THE ERROR
				if(error){return console.error(error)}
				else {
					console.log(response.statusCode, response.statusMessage)
					if(response.statusCode > 399){

						console.log("Status code " + response.statusCode);
					}
					else{
						//
						
						$ = cheerio.load(body);
  						links = $('a'); //jquery get all hyperlinks //&& $(link).attr('href').startsWith('http')
  						let blob = '';
  						$(links).each(function(i, link){
  							if ($(link).attr('href')){
    						//console.log('cheerio: ' + $(link).attr('href'));
    						blob += $(link).attr('href');
    						}
  						});
  						let linkHash = checksum(blob);
  						//console.log("blob: \n" + blob);
  						//console.log(linkHash);
  						
						//console.log(`Seeding checksum for ${page}.`)
						let hash = checksum(body);
						//console.log(hash);
						//store hash in db
						mainWindow.webContents.send('item:addPage', page, hash, linkHash, mode, Date.now());
					} // end else

				} // end else

			}); // end request
	} else {
		console.log("Not working");
		mainWindow.webContents.executeJavaScript("alert('That feed does not work.');");
	}
	//mainWindow.webContents.send('item:addPage', page);
	addWatchPageWindow.close();
});

ipcMain.on('reload:mainWindow', function(e){
	mainWindow.webContents.reloadIgnoringCache();
});

function checkHashAndMode(newHash, oldHash, newLinkHash, oldLinkHash, mode) {
	if (mode === "diff") {
		return newHash != oldHash;
	} else {
		return newLinkHash != oldLinkHash;
	}
};

//check if watched page has changed
function getPage(pageObj){
	//console.log('getpage');
	let options = {
		url: pageObj.url,
  		headers: {
    			'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.84 Safari/537.36',
    			'Content-Type':'application/x-www-form-urlencoded'
  				}

	};
	request(options, function initialRequestCallback(error, response, body){
			
			//more error info?
			if(error){return console.error(error)}
			else {
				console.log(response.statusCode, response.statusMessage)
				if(response.statusCode > 399){

					console.log("status code " + response.statusCode);
				}
				else{
					console.log(`Checking checksum for ${pageObj.url}.`);
					//
					$ = cheerio.load(body);
  						links = $('a'); //jquery get all hyperlinks //&& $(link).attr('href').startsWith('http')
  						let blob = '';
  						$(links).each(function(i, link){
  							if ($(link).attr('href')){
    						//console.log('cheerio: ' + $(link).attr('href'));
    						blob += $(link).attr('href');
    						}
  						});
  					let currentLinkHash = checksum(blob);

  					let currentHash = checksum(body);
					
					if (checkHashAndMode(currentHash, pageObj.hash, currentLinkHash, pageObj.linkHash, pageObj.mode)){
					//if (currentHash != pageObj.hash && currentLinkHash != pageObj.linkHash){
						console.log(pageObj.url + ' has changed!');
						
						//update db.pages
						//spoof rss feed object to reuse table code
						let now = moment();
						let item = {};
						let published = now;
						item.published = now.diff(published, 'minutes'); // for sorting
						item.hoursAgo = moment(published).fromNow(); // for display
						item.revisedLink = pageObj.url;
						item.sourceLink = pageObj.url;
						
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
						mainWindow.webContents.send('item:add', item);	
						//update db.pages
						//use Date.now() for db, moment for display
						mainWindow.webContents.send('item:updatePage', pageObj.url, currentHash, currentLinkHash, Date.now());

					} else {
						console.log(pageObj.url + " unchanged");

						//update db.pages
						//spoof rss feed object to reuse table code
						let now = moment();
						let item = {};
						let published = now;
						item.published = now.diff(published, 'minutes'); // for sorting
						item.hoursAgo = moment(published).fromNow(); // for display
						if (item.hoursAgo > now) {
							item.hoursAgo = now;
						}
						item.revisedLink = pageObj.url;
						item.sourceLink = pageObj.url;
						
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
						mainWindow.webContents.send('item:add', item);	
						//no need to update db since there's been no change
					}
					
				} // end else

			} // end else

		}); // end request
}

function isHTML(str) {
	if (str){
		//hacky way to filter for two word+ author names
  		return /<[a-z/][\s\S]*>/i.test(str) || str.indexOf("@") !== -1 || str.indexOf(" ") === -1;
	} else {
		//null case
		return true; 
	}
}

//fetch feeds
function getFeed(theFeed, timeWindow){
	
	const req = request(theFeed);
	const feedparser = new FeedParser();

	req.on('error', function (error) {
	  // handle any request errors
	  console.log('>error: ' + error);
	  //mainWindow.webContents.send('item:removeFeed', theFeed);
	});

	req.on('response', function (res) {
	  var stream = this; // `this` is `req`, which is a stream

	  if (res.statusCode !== 200) {
	    this.emit('error', new Error('Bad status code!'));
	    console.log("status code " + res.statusCode);
	    mainWindow.webContents.send('item:removeFeed', theFeed);
	    //return this.emit('error', new Error('Bad status code'))
	  }
	  else {
	    stream.pipe(feedparser);
	  }
	});

	feedparser.on('error', function (error) {
	  // always handle errors
	  console.log(error, error.stack);
	  console.log("error here " + theFeed);
	  //process.exit(1);
	  this.emit('end', error);
	});

	feedparser.on('readable', function () {
	  // This is where the feeds get processed
	  let stream = this; // `this` is `feedparser`, which is a stream
	  let meta = this.meta; // **NOTE** the 'meta' is always available in the context of the feedparser instance
	  let item;
	  let now = moment(); //now
	  //console.log(meta);

	  while (item = stream.read()) {
	    
	    if (!isHTML(item.author)) {
	    	item.foundAuthor = item.author;
	    } 
	 	
	    item.revisedLink = item.link;
	    item.sourceLink = theFeed;
	    
	    let altURLs = [...getUrls(item.description)]; //set to array

	    //reddit sets are size 3
	    if (altURLs.length === 3 && meta.title === 'newest submissions : technology'){
	    	item.revisedLink = altURLs[1];
	    	item.viaLink = item.link;
	    	item.viaTitle = 'Reddit';
	    	
	    	
	    } else if (meta.title === 'Techmeme'){
	    	if (!altURLs[0].includes('techmeme')){
	    		item.revisedLink = altURLs[0];
	    		item.viaLink = item.link;
	    		item.viaTitle = meta.title;
	    		
	    	} else {
	    		item.revisedLink = altURLs[altURLs.length - 1];
	    		item.viaLink = item.link;
	    		item.viaTitle = meta.title;
	    		
	    	}
	    	
	    } else if (meta.title === 'Hacker News'){
	    	item.viaLink = altURLs[0];
	    	item.viaTitle = meta.title;

	    } else if (meta.title === 'Hacker News: Newest'){
	    	item.viaLink = altURLs[2]; //https://hnrss.org/newest API differs from Hacker News RSS
	    	item.viaTitle = 'Hacker News+';

	    } else if (meta.title === 'Technology - Google News'){
	    	item.viaLink = altURLs[altURLs.length - 1];
	    	item.viaTitle = 'Google News';

	    } else if (meta.title === 'Articles and Investigations - ProPublica') {
	    	item.revisedLink = meta.link;

	    } else if (meta.title === 'Lobsters'){
	    	item.viaLink = altURLs[0];
	    	item.viaTitle = 'Lobste.rs';
	    }
	  
	  	let published = item.pubDate || meta.pubDate || Date.now();
	  	
	  	item.published = now.diff(published, 'minutes'); //use for sorting
	  	let hoursAgo = moment(published).fromNow();
	  	item.hoursAgo = hoursAgo;
	    
	    
		//list stories 12 hours old or less
	    if (parseInt(item.published) <= timeWindow) {
	    	//send each article object to mainWindow
	    	mainWindow.webContents.send('item:add', item);
		}
	  }
	});

	feedparser.on('end', () => {
	  //console.log('End parsing ' + theFeed);
	});

}

// Make method externaly visible
exports.processFeeds = arg => {  
    
    global.showFeedsList.defaultFeedsList = [];

    for (var i = 0; i < arg.length; i++){
    	//add rssLink to array
    	global.showFeedsList.defaultFeedsList.push(arg[i].rssLink);

    	if (arg[i].visible) {
    	//TODO: check if online: https://www.npmjs.com/package/is-online
    	//get articles from rss feed
    	getFeed(arg[i].rssLink, global.timeWindow.minutes);
    	}
    }
    
    //to stop progress bar, which doesn't work
    mainWindow.webContents.send('stop', true);
}

exports.processPages = arg => {
	for (var i = 0; i < arg.length; i++){
		//console.log(arg[i]);
		if (arg[i].visible) {
		getPage(arg[i]);
		}
	}

}



//create menu template
const mainMenuTemplate = [
	//file menu
		{
		label: 'File',
		submenu: [{
			label: 'Add Feed',
			accelerator: 'CmdOrCtrl+D',
			click(){
				createAddWindow();
			}
		},
		{
			label: 'Add Watched Page',
			accelerator: 'CmdOrCtrl+W',
			click(){
				createAddWatchPageWindow();
			}
		},
		{
			role: 'reload'
		},
		
		{ type: 'separator' },
		{
			label: 'Show Feeds',
			accelerator: 'CmdOrCtrl+F',
			click(){
				createFeedWindow();
				//mainWindow.webContents.send('item:list');
			}
		},
		{
			label: 'Show Watched Pages',
			accelerator: 'CmdOrCtrl+P',
			click(){
				createPageWindow();
			}
		},
		{ type: 'separator' },
		{
			label: 'Load Defaults',
			accelerator: 'CmdOrCtrl+L',
			click(){
				mainWindow.webContents.send('defaults');
			}
		},
		{
			label: 'Import Feeds',
			accelerator: 'CmdOrCtrl+M',
			click(){
				importDB();
				//mainWindow.webContents.send('import');
			}
		},
		{
			label: 'Export Feeds',
			accelerator: 'CmdOrCtrl+T',
			click(){
				exportDB();
				//mainWindow.webContents.send('export', dirpath);
			}
		},
		{
			label: 'Delete Database',
			click(){
				mainWindow.webContents.send('item:dbclear');
			}
		},
		{ type: 'separator' },
		{
			label: 'Quit',
			accelerator: 'CmdOrCtrl+Q',
			click(){
				app.quit();
			}

		}]
		},
	//edit menu
		{
        label: 'Edit',
        submenu: [
            { label: 'Undo', accelerator: 'CmdOrCtrl+Z', selector: 'undo:' },
            { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:' },
            { type: 'separator' },
            { label: 'Cut', accelerator: 'CmdOrCtrl+X', selector: 'cut:' },
            { label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
            { label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
            { label: 'Select All', accelerator: 'CmdOrCtrl+A', selector: 'selectAll:' }
        ]},
    //window menu
        {
    role: 'window',
    submenu: [
      {
        role: 'minimize'
      },
      {
        role: 'close'
      }
    ]
  },
  //help menu
    {
    role: 'help',
    submenu: [
      {
        label: 'Learn More',
        click () { require('electron').shell.openExternal('http://electron.atom.io') }
      }
    ]
  }
];


//if mac ad empty object to menu
if (process.platform === 'darwin') {
  const name = app.getName()

  app.setAboutPanelOptions({
  	applicationName: app.getName(),
    applicationVersion: app.getVersion(),
    copyright: "Released under the MIT license",
    credits: "Thomas Claburn, Lot 49 Labs"
  })

  mainMenuTemplate.unshift({
    label: name,
    submenu: [
      {
        role: 'about'
      },
      {
        type: 'separator'
      },
      {
        role: 'services',
        submenu: []
      },
      {
        type: 'separator'
      },
      {
        role: 'hide'
      },
      {
        role: 'hideothers'
      },
      {
        role: 'unhide'
      },
      {
        type: 'separator'
      },
      {
        role: 'quit'
      }
    ]
  })
  // Edit menu.
  mainMenuTemplate[2].submenu.push(
    {
      type: 'separator'
    },
    {
      label: 'Speech',
      submenu: [
        {
          role: 'startspeaking'
        },
        {
          role: 'stopspeaking'
        }
      ]
    }
  )
  // Window menu.
  mainMenuTemplate[3].submenu = [
    {
      label: 'Close',
      accelerator: 'CmdOrCtrl+W',
      role: 'close'
    },
    {
      label: 'Minimize',
      accelerator: 'CmdOrCtrl+M',
      role: 'minimize'
    },
    {
      label: 'Zoom',
      role: 'zoom'
    },
    {
      type: 'separator'
    },
    {
      label: 'Bring All to Front',
      role: 'front'
    }
  ]
};

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
				focusedWindow.toggleDevTools();
				}
			}
		}
		]
	});
};
