const electron = require("electron");
const { ipcRenderer, remote } = electron;
const ul = document.querySelector("ul");
const db = require("../js/mydatabase");

const Store = require("electron-store");
const store = new Store();

const { parse } = require("tldjs");

console.log(remote.getGlobal("fdb").db);
let feedList = remote.getGlobal("fdb").db;

let colorWell;
const defaultColor = "#039be5";

for (var i = 0; i < feedList.length; i++) {
  console.log("id = " + feedList[i].id);
  if (remote.getGlobal("fdb").db[i].visible) {
    console.log("Visible " + remote.getGlobal("fdb").db[i].visible);
  } else {
    console.log("Not visible " + remote.getGlobal("fdb").db[i].visible);
  }

  ul.className = "collection";
  const li = document.createElement("li");
  li.className = "collection-item";

  const itemText = document.createTextNode(feedList[i].rssLink);

  const a = document.createElement("a");
  a.appendChild(itemText);
  a.setAttribute("id", i);
  a.setAttribute("href", "#");

  a.addEventListener("click", function() {
    console.log("Trying to delete feed " + this.innerHTML);
    //remove from db
    let thisFeed = this.innerHTML;
    deleteItem(thisFeed);
    //remove from feedWindow
    this.parentNode.parentNode.removeChild(a.parentNode);
  });

  li.appendChild(a);
  ul.appendChild(li);

  let colorObj = parse(feedList[i].rssLink);
  let trimmedColorObj = colorObj.domain;
  let colorKey = trimmedColorObj.replace(/\./g, "");
  let setColor = store.get(colorKey, defaultColor);
  let placeholderFilterTerms;
  if (feedList[i].filterList) {
    placeholderFilterTerms =
      "Now filtering for &quot;" +
      feedList[i].filterList +
      "&quot;. You may enter new terms or &quot;*&quot; to clear.";
  } else {
    placeholderFilterTerms =
      "Now showing all items. You may enter filter terms.";
  }

  //The beforebegin and afterend positions work only if the node is in the DOM tree and has a parent element.
  if (feedList[i].visible) {
    //a.insertAdjacentHTML('beforebegin', '<i class="tiny material-icons">delete</i>');
    a.insertAdjacentHTML(
      "afterend",
      `<div class="switch">
        <label>Off<input id="s${i}" type="checkbox" checked><span class="lever"></span>On</label>
        <label style="margin-left:2.5em" for="colorWell${i}">Color:</label>
        <input style="margin-left:0.5em" id="colorWell${i}" type="color" value="${setColor}">
        <label style="margin-left:2.5em" for="filter${i}">Filter:</label>
        <input style="margin-left:0.5em" id="filter${i}" type="text" value="" placeholder="${placeholderFilterTerms}" onchange="updateFilterTerms(this.value, ${feedList[i].id}, this)">
        </div>`
    );
  } else {
    a.insertAdjacentHTML(
      "afterend",
      `<div class="switch">
        <label>Off<input id="s${i}" type="checkbox"><span class="lever"></span>On</label>
        <label style="margin-left:2.5em" for="colorWell${i}">Color:</label>
        <input style="margin-left:0.5em" id="colorWell${i}" type="color" value="${setColor}">
        <label style="margin-left:2.5em" for="filter${i}">Filter:</label>
        <input style="margin-left:0.5em" id="filter${i}" type="text" value="" placeholder="${placeholderFilterTerms}" onchange="updateFilterTerms(this.value, ${feedList[i].id}, this)">
        </div>`
    );
  }
  //get ID of db entry, use checked or unchecked as appropriate
  let switchIndex = "s" + i;
  //console.log(switchIndex);
  let lever = document.getElementById(switchIndex);

  lever.addEventListener("change", function() {
    let theURL = this.parentNode.parentNode.parentNode.firstChild.innerHTML;
    let status = this.checked ? 1 : 0;

    db.transaction("rw", db.urls, function*() {
      yield db.urls
        .where("rssLink")
        .equals(theURL)
        .modify({ visible: status });
      ipcRenderer.send("reload:mainWindow");
    }).catch(e => {
      console.error(e.stack);
    });
  });

  let colorWellIndex = "colorWell" + i;
  let colorWell = document.getElementById(colorWellIndex);

  colorWell.addEventListener(
    "input",
    function() {
      let domainString =
        event.target.parentNode.parentNode.firstChild.innerHTML;
      let domainObj = parse(domainString);
      let trimmedDomain = domainObj.domain;
      let domainKey = trimmedDomain.replace(/\./g, "");

      store.set(domainKey, event.target.value);

      ipcRenderer.send("reload:mainWindow");
    },
    false
  );
}

function updateFilterTerms(val, id, el) {
  if (val === "*") {
    console.log("Get rid of filter term");
    val = "";
  }

  db.transaction("rw", db.urls, function*() {
    yield db.urls
      .where("id")
      .equals(id)
      .modify({ filterList: val });
  })
    .then(() => {
      el.value = "";
      if (val === "") {
        el.placeholder = "Now showing all items. You may enter filter terms.";
      } else {
        el.placeholder = `Now filtering for "${val}". You may enter new terms or "*" to clear.`;
      }
      ipcRenderer.send("reload:mainWindow");
    })
    .catch(e => {
      console.error(e.stack);
    });
}

function deleteItem(feed) {
  db.transaction("rw", db.urls, function*() {
    var deleteCount = yield db.urls
      .where("rssLink")
      .equals(feed)
      .delete();

    console.log("Successfully deleted " + deleteCount + " item(s)");
    //find link in array of objects
    let index = remote.getGlobal("fdb").db.findIndex(x => x.rssLink === feed);
    let tempfeedList = remote.getGlobal("fdb").db;
    tempfeedList.splice(index, 1);
    remote.getGlobal("fdb").db = tempfeedList;
  })
    .then(() => {
      ipcRenderer.send("reload:mainWindow");
    })
    .catch(e => {
      console.error(e);
    });
}
