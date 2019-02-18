const electron = require('electron');
const { ipcRenderer, remote } = electron;
const ul = document.querySelector('ul');
const table = document.querySelector('table');

const headerBackgroundColor = "#c5cae9";
const header = table.createTHead();
const row = header.insertRow(0);
const cell0 = row.insertCell(0);
cell0.style.textAlign = 'center';
cell0.style.backgroundColor = headerBackgroundColor;
const cell1 = row.insertCell(1);
cell1.style.textAlign = 'center';
cell1.style.backgroundColor = headerBackgroundColor;
const cell2 = row.insertCell(2);
cell2.style.textAlign = 'center';
cell2.style.backgroundColor = headerBackgroundColor;
cell0.innerHTML = "Published";
cell1.innerHTML = "Headline";
cell2.innerHTML = "Source";


const shell = require('electron').shell;
const main = remote.require('./main.js');
//main.test();
const db = require('../js/mydatabase');
const Config = require('electron-config');
const config = new Config();
const fs = require('fs');
const version = require('../package').version;
const dialog = require('electron').remote.dialog;

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
//$(document).ready(function() {
//  $('.dropdown-button').dropdown({hover: false});
//});

//M.AutoInit();

document.addEventListener('DOMContentLoaded', function () {
  let elems = document.querySelectorAll('.dropdown-trigger');
  let options = { "hover": false }
  let instances = M.Dropdown.init(elems, options);
});



//remove Materialze Toast messages when clicked
//$(document).on('click', '#toast-container .toast', function() {
//  $(this).fadeOut(function() {
//    $(this).remove();
//  });
//});

//set time window from mainWindow.html
function setter(val) {
  let oldval = remote.getGlobal('timeWindow').minutes;
  let newval = val * 60;
  remote.getGlobal('timeWindow').minutes = newval;
  config.set('savedTime', newval);
  let hours = val === 1 ? ' hour' : ' hours';
  document.getElementById('Time').innerHTML = val + hours;
  if (oldval !== newval) {
    ipcRenderer.send('reload:mainWindow');
  }
}

function displayCancelShow(){
  let cancelButton = document.getElementById('Clear');
  cancelButton.style.visibility = 'visible';
}

function displayCancelHide(){
  let cancelButton = document.getElementById('Clear');
  cancelButton.style.visibility = 'hidden';
  document.getElementById('query').value = '';
  searchFunction();
}

function searchFunction() {
  let input, filter, tr, td, i;
  input = document.getElementById('query');
  //console.log(input.value);
  filter = input.value.toUpperCase();
  //table = document.getElementById("myTable");
  tr = table.getElementsByTagName('tr');
  for (i = 1; i < tr.length; i++) {
    td = tr[i].getElementsByTagName('td')[1];
    if (td) {
      if (td.innerHTML.toUpperCase().indexOf(filter) > -1) {
        tr[i].style.display = '';
      } else {
        tr[i].style.display = 'none';
      }
    }
  }
}

//turn progress bar on or off
function toggleProgressBar(bstate) {
  let bar =
    document.getElementsByClassName('determinate')[0] ||
    document.getElementsByClassName('indeterminate')[0];
  bar.className = bstate;
  //console.log(bstate);
}

//do this when the window has loaded
window.onload = () => {
  toggleProgressBar('indeterminate');
  let hours = remote.getGlobal('timeWindow').minutes / 60;
  setter(hours);
  //start everthing up
  setup();
};



function checkWatchedPages() {
  db.transaction('r', db.pages, function* () {
    yield db.pages
      .where('timeChecked')
      .below(Date.now())
      .toArray(function (watchPages) {
        //console.log("Checking page database");
        remote.getGlobal('pdb').db = watchPages;
        main.processPages(watchPages);
      })
      .catch(function (err) {
        console.error(err);
      });
  });
}

function setup() {
  db.transaction('r', db.urls, db.pages, function* () {
    // Make sure we have something in DB:
    //if ((yield db.urls.where('rssLink').equals('https://www.theregister.co.uk/headlines.atom').count()) === 0) {

    if ((yield db.urls.count()) === 0 && (yield db.pages.count()) === 0) {
      M.toast({ html: 'Add Feeds or Watched Pages', displayLength: 8000 });
    } else {
      // Query:
      //console.log("Checking feed database");
      let recentLinks = yield db.urls
        .where('timeChecked')
        .below(Date.now())
        .toArray();
      remote.getGlobal('fdb').db = recentLinks;

      //send feed array to be processed
      main.processFeeds(recentLinks);
    }
  })
  .then(() => {
      //now handle watched pages
      checkWatchedPages();
    })
    .catch(e => {
      console.error(e.stack);
    });
}

ipcRenderer.on('stop', function () {
  console.log('stop handler');
  toggleProgressBar('determinate');
});

//not yet functional for watchedPages db
ipcRenderer.on('import', function (e, dirpath) {
  if (fs.existsSync(dirpath)) {
    console.log('import ' + dirpath);
    let importObj = JSON.parse(fs.readFileSync(dirpath, 'utf8'));

    importObj.forEach(function (arrayItem) {
      for (const [key, value] of Object.entries(arrayItem)) {
        console.log(`${key} ${value}`);
        if (key === 'rssLink') {
          let item = value;
          db.transaction('rw', db.urls, function* () {
            if (
              (yield db.urls
                .where('rssLink')
                .equals(item)
                .count()) === 0
            ) {
              //add rssLink to db
              console.log(`Import ${item} to db`);
              let id = yield db.urls.add({
                rssLink: item,
                timeChecked: Date.now(),
                visible: 1,
              });
            } else {
              console.log(`${item} already exists in db`);
            }
          }).catch(e => {
            console.error(e.stack);
          });
        }
      }
    });
    //
    db.transaction('r', db.urls, db.pages, function* () {
      let recentLinks = yield db.urls
        .where('timeChecked')
        .below(Date.now())
        .toArray();
      remote.getGlobal('fdb').db = recentLinks;
    })
      .then(() => {
        M.toast({ html: 'vfdb.json imported', displayLength: 4000 });
        
      })
      .catch(e => {
        console.error(e.stack);
      });
    //
  } else {
    M.toast({ html: 'vfdb.json file not found', displayLength: 4000 });
  }
});

//not yet functional for watchedPages db
ipcRenderer.on('export', function (e, dirpath) {
  console.log(dirpath);

  db.transaction('r', db.urls, db.pages, function* () {
    let recentLinks = yield db.urls
      .where('timeChecked')
      .below(Date.now())
      .toArray();
    remote.getGlobal('fdb').db = recentLinks;
    fs.writeFile(
      dirpath + '/vfdb.json',
      JSON.stringify(recentLinks),
      'utf8',
      function (err) {
        console.log(`file saved at ${dirpath}`);
        dialog.showMessageBox({
          message: `The file vfdb.json has been saved at\n${dirpath}`,
          buttons: ['OK'],
        });
        //check if file exists before writing
      }
    );
  })
    .then(() => {
      //Materialize.toast('vfdb.json file saved', 4000);
    })
    .catch(e => {
      console.error(e.stack);
    });
});

ipcRenderer.on('defaults', function () {
  console.log('defaults');
  db.transaction('rw', db.urls, function* () {
    if ((yield db.urls.count()) === 0) {
      let id = yield db.urls.bulkPut([
        {
          rssLink: 'https://www.theregister.co.uk/headlines.atom',
          visible: 1,
          timeChecked: Date.now(),
        },
        {
          rssLink: 'https://news.ycombinator.com/rss',
          visible: 1,
          timeChecked: Date.now(),
        },
        {
          rssLink: 'https://export.arxiv.org/rss/cs/new',
          visible: 1,
          timeChecked: Date.now(),
        },
        {
          rssLink: 'https://www.reddit.com/r/technology/new.rss',
          visible: 1,
          timeChecked: Date.now(),
        },
        {
          rssLink: 'https://blog.google/rss/',
          visible: 1,
          timeChecked: Date.now(),
        },
        {
          rssLink: 'https://www.techmeme.com/feed.xml',
          visible: 1,
          timeChecked: Date.now(),
        },
        {
          rssLink:
            'https://news.google.com/news/rss/headlines/section/topic/TECHNOLOGY',
          visible: 1,
          timeChecked: Date.now(),
        },
        {
          rssLink: 'https://lwn.net/headlines/rss',
          visible: 1,
          timeChecked: Date.now(),
        },
        {
          rssLink: 'https://hnrss.org/newest',
          visible: 1,
          timeChecked: Date.now(),
        },
      ]);
    }
    // Query:
    let recentLinks = yield db.urls
      .where('timeChecked')
      .below(Date.now())
      .toArray();
    remote.getGlobal('fdb').db = recentLinks;

    main.processFeeds(recentLinks);
  }).catch(e => {
    console.error(e.stack);
  });
});

function openLink(link, el) {
  shell.openExternal(link);
  el.style.color = clickedColor;
}

//build mainWindow table via main.js/getFeed
ipcRenderer.on('item:add', function (e, item, filter) {
  let filteredOrNot = '';

  if (item.filterList) {
    if (
      item.title.toUpperCase().indexOf(item.filterList.toUpperCase()) === -1
    ) {
      //console.log("Didn't find " + item.filterList + " in " + item.title);
      //so don't display it
      filteredOrNot = 'none';
      return;
    }
  }

  if (item.lastChecked) {
    console.log('lastChecked');
  }
  const tr = document.createElement('tr');
  tr.style.whiteSpace = 'nowrap';
  tr.style.overflow = 'hidden';
  tr.style.textOverflow = 'ellipsis';
  tr.style.display = filteredOrNot;

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
  let sourceKey = sourceDomain.replace(/\./g, '');

  const a = document.createElement('a');
  a.setAttribute('href', '#');
  a.setAttribute('class', sourceKey);
  //a.setAttribute("onclick","shell.openExternal('"+item.revisedLink+"')");
  //a.setAttribute("onclick", "openLink('"+item.revisedLink+"')");
  a.onclick = function () {
    openLink(item.revisedLink, a);
  };
  if (item.foundAuthor) {
    a.title = item.foundAuthor;
  }
  //get rid of arXiv headline junk & trim headline // trimming now handles in CSS for TD
  let displayTitle = item.title.split('. (arXiv')[0].substring(0, 200);
  if (displayTitle.length === 200) {
    displayTitle += '...';
  }
  const linkText = document.createTextNode(displayTitle);
  a.appendChild(linkText);

  let linkColor = config.get(sourceKey, defaultColor);
  //alter linkColor for unchanged watched pages
  if (item.changedText) {
    if (item.changedText.includes('unchanged')) {
      linkColor = unchangedColor;
    }
  }

  a.style.color = linkColor;

  td1.appendChild(a);

  const td2 = document.createElement('td');
  td2.style.width = '20%';

  if (item.viaLink) {
    domain += ', via ';
  }
  const sourceLink = document.createTextNode(domain);
  td2.appendChild(sourceLink);

  if (item.viaLink) {
    const b = document.createElement('a');
    b.setAttribute('href', '#');
    b.setAttribute('onclick', "shell.openExternal('" + item.viaLink + "')");

    const viaTitle = document.createTextNode(item.viaTitle);
    b.appendChild(viaTitle);

    td2.appendChild(b);
  }

  if (item.lastChecked && item.changedText) {
    const since = document.createTextNode(item.changedText);
    td2.appendChild(since);
    td2.style.color = linkColor;
  }

  tr.appendChild(td0).classList.add('time');
  tr.appendChild(td1).classList.add('storyLink');
  tr.appendChild(td2).classList.add('source');

  table.appendChild(tr);
});

//not used yet
ipcRenderer.on('refresh', function () {
  db.transaction('r', db.urls, function* () {
    yield db.urls
      .toArray(function (feedDB) {
        console.log(feedDB.length);
        remote.getGlobal('fdb').db = feedDB;
      })
      .catch(function (err) {
        console.error(err);
      });
  });
});

//clear db
ipcRenderer.on('item:dbclear', function () {
  db.transaction('rw', db.urls, function* () {
    var deleteCount = yield db.urls
      .where('timeChecked')
      .below(Date.now())
      .delete();

    console.log('Successfully deleted ' + deleteCount + ' items');
  }).catch(e => {
    console.error(e);
  });

  db.transaction('rw', db.pages, function* () {
    var deleteCount = yield db.pages
      .where('timeChecked')
      .below(Date.now())
      .delete();

    console.log('Successfully deleted ' + deleteCount + ' items');
  }).catch(e => {
    console.error(e);
  });

  remote.getGlobal('showFeedsList').defaultFeedsList = [];
  remote.getGlobal('fdb').db = [];
  remote.getGlobal('pdb').db = [];
  config.clear();
  table.innerHTML = '';
  M.toast({ html: 'Feeds cleared', displayLength: 4000 });

  //remote.getGlobal('showFeedsList').defaultFeedsList = [];
  //Materialize.toast('Feeds cleared', 4000)
});

//receive addFeed item from addWindow, via main.js
ipcRenderer.on('item:addFeed', function (e, item, filter) {
  //TODO: error check item for proper RSS format
  console.log('addFeed', filter);

  let recentLinks;
  db.transaction('rw', db.urls, function* () {
    if (
      (yield db.urls
        .where('rssLink')
        .equals(item)
        .count()) === 0
    ) {
      //add rssLink to db
      console.log('Add ' + item + ' to db');
      let id = yield db.urls.add({
        rssLink: item,
        timeChecked: Date.now(),
        visible: 1,
        filterList: filter,
      });
      //alert (`I added url with id ${id}`);
      recentLinks = yield db.urls
        .where('timeChecked')
        .below(Date.now())
        .toArray();
    } else {
      alert('That feed exists already');
    }
  })
    .then(() => {
      console.log('updating list: ' + item);
      //redo the table
      table.innerHTML = '';
      //main.processFeeds(recentLinks);
      //remote.getGlobal('showFeedsList').defaultFeedsList.push(item);
      ipcRenderer.send('reload:mainWindow');
    })
    .catch(e => {
      console.error(e.stack);
      alert('There was a problem with ' + item + " so it's been removed");
      deleteItem(item);
    });
});

//receive addRepo from main.js, via addRepo.js
ipcRenderer.on('item:addRepo', function (e, page, hash, linkHash, mode, now) {
  //TODO: error check item for proper RSS format
  console.log(
    'addRepo received\n' +
    page +
    '\nand\n' +
    hash +
    '\nand\n' +
    linkHash +
    '\nand\n' +
    '\nand\n' +
    mode +
    '\nand\n' +
    now
  );

  db.transaction('rw', db.pages, function* () {
    if (
      (yield db.pages
        .where('url')
        .equals(page)
        .count()) === 0
    ) {
      //add page to db
      console.log('Add ' + page + ' to db');
      let id = yield db.pages.add({
        url: page,
        timeChecked: Date.now(),
        hash: hash,
        linkHash: linkHash,
        mode: mode,
        visible: 1,
      });

      let watchedPages = yield db.pages
        .where('timeChecked')
        .below(Date.now())
        .toArray();
      console.log(watchedPages.length);
      //main.processFeeds(recentLinks);
    } else {
      alert('That page is already being watched');
    }
  })
    .then(() => {
      console.log('updating list: ' + page);
      //remote.getGlobal('showFeedsList').defaultFeedsList.push(item);
      ipcRenderer.send('reload:mainWindow');
    })
    .catch(e => {
      console.error(e.stack);
      alert('There was a problem with ' + page);
    });
});

//receive addPage from addWatchPage.js
ipcRenderer.on('item:addPage', function (e, page, hash, linkHash, mode, now) {
  //TODO: error check item for proper RSS format
  console.log(
    'addPage received\n' +
    page +
    '\nand\n' +
    hash +
    '\nand\n' +
    linkHash +
    '\nand\n' +
    '\nand\n' +
    mode +
    '\nand\n' +
    now
  );

  db.transaction('rw', db.pages, function* () {
    if (
      (yield db.pages
        .where('url')
        .equals(page)
        .count()) === 0
    ) {
      //add page to db
      console.log('Add ' + page + ' to db');
      let id = yield db.pages.add({
        url: page,
        timeChecked: Date.now(),
        hash: hash,
        linkHash: linkHash,
        mode: mode,
        visible: 1,
      });

      let watchedPages = yield db.pages
        .where('timeChecked')
        .below(Date.now())
        .toArray();
      console.log(watchedPages.length);
      //main.processFeeds(recentLinks);
    } else {
      alert('That page is already being watched');
    }
  })
    .then(() => {
      console.log('updating list: ' + page);
      //remote.getGlobal('showFeedsList').defaultFeedsList.push(item);
      ipcRenderer.send('reload:mainWindow');
    })
    .catch(e => {
      console.error(e.stack);
      alert('There was a problem with ' + page);
    });
});

ipcRenderer.on('item:updatePage', function (e, page, thisHash, linkHash, now) {
  db.transaction('rw', db.pages, function* () {
    yield db.pages
      .where('url')
      .equals(page)
      .modify({ hash: thisHash, linkHash: linkHash, timeChecked: now });
    console.log('Updated db.pages');
    //ipcRenderer.send('reload:mainWindow');
    //?
    //remote.getGlobal('fdb').db[i].visible = status;
    //console.log("Set to " + status + " " + remote.getGlobal('fdb').db[i].visible);
  }).catch(e => {
    console.error(e.stack);
  });
});

//delete item from db
function deleteItem(feed) {
  db.transaction('rw', db.urls, function* () {
    var deleteCount = yield db.urls
      .where('rssLink')
      .equals(feed)
      .delete();

    console.log('Successfully deleted ' + deleteCount + ' items');
  })
    .then(() => {
      //ipcRenderer.send('reload:mainWindow');
    })
    .catch(e => {
      console.error(e);
    });
}

//remove item
ul.addEventListener('dblclick', removeItem);

function removeItem(e) {
  e.target.remove();
  if (ul.children.length == 0) {
    ul.className = '';
  }
}

function sortTable() {
  let theTable,
    rows,
    switching,
    i,
    x,
    y,
    shouldSwitch,
    dir,
    switchcount = 0;
  theTable = document.getElementById('myTable');
  switching = true;
  document.getElementById('Sort').parentNode.className = 'active';
  toggleProgressBar('indeterminate');
  // Set the sorting direction to ascending:
  dir = 'asc';
  /* Make a loop that will continue until
    no switching has been done: */
  while (switching) {
    // Start by saying: no switching is done:
    switching = false;
    rows = theTable.getElementsByTagName('TR');
    /* Loop through all table rows (except the
      first, which contains table headers): */
    for (i = 0; i < rows.length - 1; i++) {
      // Start by saying there should be no switching:
      shouldSwitch = false;
      /* Get the two elements you want to compare,
        one from current row and one from the next: */
      x = rows[i].getElementsByTagName('TD')[0];
      y = rows[i + 1].getElementsByTagName('TD')[0];
      /* Check if the two rows should switch place,
        based on the direction, asc or desc: */
      if (dir === 'asc') {
        if (parseInt(x.id) > parseInt(y.id)) {
          // If so, mark as a switch and break the loop:
          shouldSwitch = true;
          break;
        }
      } else if (dir === 'desc') {
        if (parseInt(x.id) < parseInt(y.id)) {
          // If so, mark as a switch and break the loop:
          shouldSwitch = true;
          break;
        }
      }
    }
    if (shouldSwitch) {
      /* If a switch has been marked, make the switch
        and mark that a switch has been done: */
      rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
      switching = true;
      // Each time a switch is done, increase this count by 1:
      switchcount++;
    } else {
      /* If no switching has been done AND the direction is "asc",
        set the direction to "desc" and run the while loop again. */
      if (switchcount === 0 && dir === 'asc') {
        dir = 'desc';
        switching = true;
      }
    }

    if (switchcount > rows.length * 1000) {
      console.log('Timed out');
      console.log(switchcount, rows.length);
      break;
    }
  }
  toggleProgressBar('determinate');
  M.toast({ html: 'Done', displayLength: 3000 });
  document.getElementById('Sort').parentNode.className = '';
  console.log(switchcount, rows.length);
}
