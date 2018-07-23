const electron = require('electron');
const {ipcRenderer, remote} = electron;
const ul = document.querySelector('ul');
const table = document.querySelector('table');

const shell = require('electron').shell;
const main = remote.require("./main.js");
//main.test();
const db = require('../js/mydatabase');
const Config = require('electron-config');
const config = new Config();
const fs = require("fs");
const version = require('../package').version;
const dialog = require('electron').remote.dialog 

const { parse } = require('tldjs');
/*
parse('mail.google.co.uk');
{ hostname: 'mail.google.co.uk',
  isValid: true,
  tldExists: true,
  publicSuffix: 'co.uk',
  domain: 'google.co.uk',
  subdomain: 'mail' }
*/

const defaultColor = '#039be5';
const unchangedColor = '#C0C0C0';
const clickedColor = '#024d72';
//will this conflict with cheerio: https://api.jquery.com/jquery.noconflict/
//setup dropdown menus
$( document ).ready(function(){
    $(".dropdown-button").dropdown({ hover: false });
})

//remove Materialze Toast messages when clicked
$(document).on('click', '#toast-container .toast', function() {
    $(this).fadeOut(function(){
        $(this).remove();
    });
});

//set time window from mainWindow.html
function setter(val){
    let oldval = remote.getGlobal('timeWindow').minutes;
    let newval = val * 60;
    remote.getGlobal('timeWindow').minutes = newval;
    config.set('savedTime', newval);
    let hours = val === 1 ? " hour" : " hours";
    document.getElementById('Time').innerHTML = val + hours;
    if (oldval !== newval ){
        ipcRenderer.send('reload:mainWindow');
    }
}

//turn progress bar on or off
function toggleProgressBar(bstate){
    let bar = document.getElementsByClassName("determinate")[0] || document.getElementsByClassName("indeterminate")[0];
    bar.className = bstate;
    //console.log(bstate);
}

//do this when the window has loaded
window.onload = () => {
    toggleProgressBar("indeterminate");
    let hours = remote.getGlobal('timeWindow').minutes/60;
    setter(hours);
    //start everthing up
    setup();
}

function checkWatchedPages(){
    db.transaction('r', db.pages, function*() {
        yield db.pages.where("timeChecked").below(Date.now()).toArray(function(watchPages) {
            //console.log("Checking page database");
            remote.getGlobal('pdb').db = watchPages;
            main.processPages(watchPages);
        }).catch(function(err) {
            console.error(err);
        });
    });
};

function setup(){
    db.transaction('r', db.urls, db.pages, function*() {
    // Make sure we have something in DB:
    //if ((yield db.urls.where('rssLink').equals('https://www.theregister.co.uk/headlines.atom').count()) === 0) {
        
        if ((yield db.urls.count()) === 0 && (yield db.pages.count()) === 0) {
            Materialize.toast('Add Feeds or Watched Pages', 8000);
            
        } else {
        // Query:
        //console.log("Checking feed database");
        let recentLinks = yield db.urls.where("timeChecked").below(Date.now()).toArray();
        remote.getGlobal('fdb').db = recentLinks;
        
        //send feed array to be processed
        main.processFeeds(recentLinks);
        }
    }).then ( () => {
         //now handle watched pages
         checkWatchedPages();
    }).catch(e => {
        console.error (e.stack);
    });
}


ipcRenderer.on('stop', function(){
    console.log('stop handler');
    toggleProgressBar("determinate");
});

//not yet functional for watchedPages db
ipcRenderer.on('import', function(e, dirpath){
    
    if (fs.existsSync(dirpath)) {
        console.log("import " + dirpath);
        let importObj = JSON.parse(fs.readFileSync(dirpath, 'utf8'));

        importObj.forEach( function (arrayItem)
        {
            for (const [key, value] of Object.entries(arrayItem)) {
            console.log(`${key} ${value}`);
                if (key === 'rssLink'){
                    let item = value;
                    db.transaction('rw', db.urls, function*() {
                        if ((yield db.urls.where('rssLink').equals(item).count()) === 0) {
                            //add rssLink to db
                            console.log(`Import ${item} to db`);
                            let id = yield db.urls.add({rssLink: item, timeChecked: Date.now(), visible: 1});
                           
                        } else {
                            console.log(`${item} already exists in db`);
                        }
                    }).catch(e => {
                        console.error (e.stack);
                    });
                }
            }
        });
        //
        db.transaction('r', db.urls, db.pages, function*() {
            let recentLinks = yield db.urls.where("timeChecked").below(Date.now()).toArray();
            remote.getGlobal('fdb').db = recentLinks;
        }).then ( () => {
            Materialize.toast('vfdb.json imported', 4000);
        }).catch(e => {
            console.error (e.stack);
        });
        //
    } else {
        Materialize.toast('vfdb.json file not found', 4000);
    }
});

//not yet functional for watchedPages db
ipcRenderer.on('export', function(e, dirpath){
    console.log(dirpath);

     db.transaction('r', db.urls, db.pages, function*() {
        let recentLinks = yield db.urls.where("timeChecked").below(Date.now()).toArray();
        remote.getGlobal('fdb').db = recentLinks;
        fs.writeFile( dirpath + '/vfdb.json', JSON.stringify( recentLinks ), 'utf8', function(err){
            console.log(`file saved at ${dirpath}`);
            dialog.showMessageBox({ message: `The file vfdb.json has been saved at\n${dirpath}`, buttons: ['OK'] });
            //check if file exists before writing
        } );
    }).then ( () => {
        //Materialize.toast('vfdb.json file saved', 4000);
    }).catch(e => {
        console.error (e.stack);
    });
});

ipcRenderer.on('defaults', function(){
    console.log('defaults');
   db.transaction('rw', db.urls, function*() {
        
    if ((yield db.urls.count()) === 0) {
        let id = yield db.urls.bulkPut([
        {rssLink:'https://www.theregister.co.uk/headlines.atom', visible: 1, timeChecked: Date.now()},
        {rssLink:'https://news.ycombinator.com/rss', visible: 1, timeChecked: Date.now()},
        {rssLink:'http://export.arxiv.org/rss/cs/new', visible: 1, timeChecked: Date.now()},
        {rssLink:'https://www.reddit.com/r/technology/new.rss', visible: 1, timeChecked: Date.now()},
        {rssLink:'https://blog.google/rss/', visible: 1, timeChecked: Date.now()},
        {rssLink:'https://www.techmeme.com/feed.xml', visible: 1, timeChecked: Date.now()},
        {rssLink:'https://news.google.com/news/rss/headlines/section/topic/TECHNOLOGY', visible: 1, timeChecked: Date.now()},
        {rssLink:'https://lwn.net/headlines/rss', visible: 1, timeChecked: Date.now()},
        {rssLink:'https://hnrss.org/newest', visible: 1, timeChecked: Date.now()},
        ]);
        
    }
    // Query:
    let recentLinks = yield db.urls.where("timeChecked").below(Date.now()).toArray();
    remote.getGlobal('fdb').db = recentLinks;

    main.processFeeds(recentLinks);
    }).catch(e => {
        console.error (e.stack);
    });
});

 function openLink(link, el){
    shell.openExternal(link);
    el.style.color = clickedColor;
    }

//build mainWindow table via main.js/getFeed
ipcRenderer.on('item:add', function(e, item){

    if (item.lastChecked) {console.log("lastChecked")};
    const tr = document.createElement('tr');
    tr.style.whiteSpace = 'nowrap';
    tr.style.overflow = 'hidden';
    tr.style.textOverflow = 'ellipsis';

    const td0 = document.createElement('td');
    td0.style.width = '15%';
    td0.id = item.published; //sort by minutes

    const timeText = document.createTextNode(item.hoursAgo);
    td0.appendChild(timeText);
    
    const td1 = document.createElement('td');
    td1.style.width = '65%';
    td1.style.whiteSpace = 'nowrap';
    td1.style.overflow = 'hidden';
    td1.style.textOverflow = 'ellipsis';

    let domainObj = parse(item.revisedLink);
    let domain = domainObj.domain;

    let sourceObj = parse(item.sourceLink);
    let sourceDomain = sourceObj.domain;
    let sourceKey = sourceDomain.replace(/\./g, "");
    
    const a = document.createElement('a');
    a.setAttribute("href", "#");
    a.setAttribute("class", sourceKey);
    //a.setAttribute("onclick","shell.openExternal('"+item.revisedLink+"')");
    //a.setAttribute("onclick", "openLink('"+item.revisedLink+"')");
    a.onclick = function(){
        openLink(item.revisedLink, a);
    }
    if (item.foundAuthor){
        a.title = item.foundAuthor;
    } 
    //get rid of arXiv headline junk & trim headline
    let displayTitle = item.title.split(". (arXiv")[0].substring(0, 80);
    if (displayTitle.length === 80) {
        displayTitle += '...';
    }
    const linkText = document.createTextNode(displayTitle);
    a.appendChild(linkText);
    
    let linkColor = config.get(sourceKey, defaultColor);
    //alter linkColor for unchanged watched pages
    if (item.changedText) {
        if (item.changedText.includes('unchanged')){
        linkColor = unchangedColor;
        }
    }
    
    a.style.color = linkColor

    td1.appendChild(a);
    
    const td2 = document.createElement('td');
    td2.style.width = '20%';
    
    if (item.viaLink){
        domain += ", via ";
    }
    const sourceLink = document.createTextNode(domain);
    td2.appendChild(sourceLink);

    if (item.viaLink){
        const b = document.createElement('a');
        b.setAttribute("href", "#");
        b.setAttribute("onclick","shell.openExternal('"+item.viaLink+"')");

        const viaTitle = document.createTextNode(item.viaTitle);
        b.appendChild(viaTitle);

        td2.appendChild(b);
    }

    if (item.lastChecked && item.changedText){
        const since = document.createTextNode(item.changedText);
        td2.appendChild(since);
        td2.style.color = linkColor;
    }
    
    tr.appendChild(td0).classList.add("time");
    tr.appendChild(td1).classList.add("storyLink");
    tr.appendChild(td2).classList.add("source");

    table.appendChild(tr);
    
});

//not used yet
ipcRenderer.on('refresh', function(){
   db.transaction('r', db.urls, function*() {
        yield db.urls.toArray(function(feedDB) {
            console.log(feedDB.length);
            remote.getGlobal('fdb').db = feedDB;

        }).catch(function(err) {
        console.error(err);
        });
        
    });
    
});

//clear db
ipcRenderer.on('item:dbclear', function(){

    db.transaction('rw', db.urls, function* () {
    var deleteCount = yield db.urls.where('timeChecked').below(Date.now()).delete();

    console.log ("Successfully deleted " + deleteCount + " items");
    }).catch (e => {
        console.error (e);
    });

    db.transaction('rw', db.pages, function* () {
    var deleteCount = yield db.pages.where('timeChecked').below(Date.now()).delete();

    console.log ("Successfully deleted " + deleteCount + " items");
    }).catch (e => {
        console.error (e);
    });


    remote.getGlobal('showFeedsList').defaultFeedsList = [];
    remote.getGlobal('fdb').db = [];
    remote.getGlobal('pdb').db = [];
    config.clear();
    table.innerHTML = '';
    Materialize.toast('Feeds cleared', 4000)

    //remote.getGlobal('showFeedsList').defaultFeedsList = [];
    //Materialize.toast('Feeds cleared', 4000)
});


//receive addFeed item from addWindow, via main.js
ipcRenderer.on('item:addFeed', function(e, item){
    //TODO: error check item for proper RSS format
    console.log("addFeed");
    
    let recentLinks
    db.transaction('rw', db.urls, function*() {
        if ((yield db.urls.where('rssLink').equals(item).count()) === 0) {
        //add rssLink to db
        console.log("Add " + item + " to db");
        let id = yield db.urls.add({rssLink: item, timeChecked: Date.now(), visible: 1});
        //alert (`I added url with id ${id}`);
        recentLinks = yield db.urls.where("timeChecked").below(Date.now()).toArray();
       
        } else {
            alert('That feed exists already');
        }
    }).then ( () => {
        console.log("updating list: " + item);
        //redo the table
        table.innerHTML = '';
        //main.processFeeds(recentLinks);
        //remote.getGlobal('showFeedsList').defaultFeedsList.push(item);
        ipcRenderer.send('reload:mainWindow');
    }).catch(e => {
    console.error (e.stack);
    alert("There was a problem with " + item + " so it's been removed");
    deleteItem(item);
    });

});

//receive addPage from addWatchPage.js
ipcRenderer.on('item:addPage', function(e, page, hash, linkHash, mode, now){
    //TODO: error check item for proper RSS format
    console.log("addPage received\n" + page + "\nand\n" + hash + "\nand\n" + linkHash + "\nand\n" + "\nand\n" + mode + "\nand\n" + now);

    db.transaction('rw', db.pages, function*() {
        if ((yield db.pages.where('url').equals(page).count()) === 0) {
        //add page to db
        console.log("Add " + page + " to db");
        let id = yield db.pages.add({url: page, timeChecked: Date.now(), hash: hash, linkHash: linkHash, mode: mode, visible: 1});
       
        let watchedPages = yield db.pages.where("timeChecked").below(Date.now()).toArray();
        console.log(watchedPages.length);
        //main.processFeeds(recentLinks);
        } else {
            alert('That page is already being watched');
        }
    }).then ( () => {
        console.log("updating list: " + page);
        //remote.getGlobal('showFeedsList').defaultFeedsList.push(item);
        ipcRenderer.send('reload:mainWindow');
    }).catch(e => {
    console.error (e.stack);
    alert("There was a problem with " + page);
    
    });



});

ipcRenderer.on('item:updatePage', function(e, page, thisHash, linkHash, now){
    db.transaction('rw', db.pages, function*() {
                yield db.pages.where('url').equals(page).modify({hash: thisHash, linkHash: linkHash, timeChecked: now});
                console.log("Updated db.pages");
                //ipcRenderer.send('reload:mainWindow');
                //?
               //remote.getGlobal('fdb').db[i].visible = status;
                //console.log("Set to " + status + " " + remote.getGlobal('fdb').db[i].visible);
    }).catch(e => {
        console.error (e.stack);
    });
});

//delete item from db
function deleteItem(feed){
        db.transaction('rw', db.urls, function* () {
        var deleteCount = yield db.urls
            .where("rssLink").equals(feed)
            .delete();

        console.log ("Successfully deleted " + deleteCount + " items");
    }).then ( () => {
        //ipcRenderer.send('reload:mainWindow');
    }).catch (e => {
        console.error (e);
    });
}

//remove item
ul.addEventListener('dblclick', removeItem);

function removeItem(e){
    e.target.remove();
    if (ul.children.length == 0){
        ul.className = '';
    }
}



function sortTable() {
  let theTable, rows, switching, i, x, y, shouldSwitch;
  theTable = document.getElementById("myTable");
  switching = true;
  document.getElementById("Sort").parentNode.className = "active";
  toggleProgressBar("indeterminate");
  /*Make a loop that will continue until
  no switching has been done:*/
  while (switching) {
    //start by saying: no switching is done:
    switching = false;
    rows = theTable.getElementsByTagName("TR");
    /*Start at index zero since there's no header row*/
    for (i = 0; i < (rows.length - 1); i++) {
      //start by saying there should be no switching:
      shouldSwitch = false;
      /*Get the two elements you want to compare,
      one from current row and one from the next:*/
      x = rows[i].getElementsByTagName("TD")[0];
      y = rows[i + 1].getElementsByTagName("TD")[0];
      
      if (parseInt(x.id) > parseInt(y.id)) {
        //if so, mark as a switch and break the loop:
        shouldSwitch= true;
        break;
      }
    }
    if (shouldSwitch) {
      /*If a switch has been marked, make the switch
      and mark that a switch has been done:*/
      rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
      switching = true;
    }
  }
  toggleProgressBar("determinate");
  Materialize.toast('Done', 1000);
}

