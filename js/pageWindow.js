const electron = require("electron");

const { ipcRenderer, remote } = electron;
const ul = document.querySelector("ul");

const Store = require("electron-store");

const store = new Store();

const { parse } = require("tldjs");
const db = require("../js/mydatabase");

console.log(remote.getGlobal("pdb").db);
const pageList = remote.getGlobal("pdb").db;

let colorWell;
const defaultColor = "#039be5";

for (let i = 0; i < pageList.length; i++) {
  console.log(`id = ${pageList[i].id}`);

  if (remote.getGlobal("pdb").db[i].visible) {
    console.log(`Visible ${remote.getGlobal("pdb").db[i].visible}`);
  } else {
    console.log(`Not visible ${remote.getGlobal("pdb").db[i].visible}`);
  }

  ul.className = "collection";
  const li = document.createElement("li");
  li.className = "collection-item";

  const itemText = document.createTextNode(pageList[i].url);

  const a = document.createElement("a");
  a.appendChild(itemText);
  a.setAttribute("id", pageList[i].id);
  a.setAttribute("href", "#");

  a.addEventListener("click", function() {
    console.log(`Trying to delete page ${this.innerHTML}`);
    // remove from db
    console.log(this.href);
    const thisFeed = this.id; // this.innerHTML;
    deletePage(thisFeed);
    // remove from feedWindow
    this.parentNode.parentNode.removeChild(a.parentNode);
  });

  li.appendChild(a);
  ul.appendChild(li);

  const colorObj = parse(pageList[i].url);
  const trimmedColorObj = colorObj.domain;
  const colorKey = trimmedColorObj.replace(/\./g, "");
  const setColor = store.get(colorKey, defaultColor);

  let filterKeyword = "None";
  if (remote.getGlobal("pdb").db[i].hash === 0) {
    //processing repo
    filterKeyword = remote.getGlobal("pdb").db[i].linkHash;
  }
  // The beforebegin and afterend positions work only if the node is in the DOM tree and has a parent element.
  if (pageList[i].visible) {
    //a.insertAdjacentHTML('beforebegin', '<i class="tiny material-icons">delete</i>');
    a.insertAdjacentHTML(
      "afterend",
      `<div class="switch">
       <label>Off<input id="s${i}" type="checkbox" checked>
       <span class="lever"></span>On</label>
       <label style="margin-left:2.5em" for="colorWell${i}">Color:</label>
       <input style="margin-left:0.5em" id="colorWell${i}" type="color" value="${setColor}">
       <label style="margin-left:2.5em">Mode: ${
         remote.getGlobal("pdb").db[i].mode
       }</label>
       <label style="margin-left:2.5em">Filter Keyword: ${filterKeyword}</label>
       </div>`
    );
  } else {
    a.insertAdjacentHTML(
      "afterend",
      `<div class="switch">
        <label>Off<input id="s${i}" type="checkbox">
        <span class="lever"></span>On</label>
        <label style="margin-left:2.5em" for="colorWell${i}">Color:</label>
        <input style="margin-left:0.5em" id="colorWell${i}" type="color" value="${setColor}">
        <label style="margin-left:2.5em">Mode: ${
          remote.getGlobal("pdb").db[i].mode
        }</label>
        <label style="margin-left:2.5em">Filter Keyword: ${filterKeyword}</label>
        </div>`
    );
  }
  // get ID of db entry, use checked or unchecked as appropriate
  const switchIndex = `s${i}`;
  // console.log(switchIndex);
  const lever = document.getElementById(switchIndex);

  lever.addEventListener("change", function() {
    // console.log(switchIndex + ' ' + this.checked);
    // console.log(this.parentNode.parentNode.parentNode.firstChild.innerHTML);
    const theURL = this.parentNode.parentNode.parentNode.firstChild.innerHTML;
    const status = this.checked ? 1 : 0;

    db.transaction("rw", db.pages, function*() {
      yield db.pages
        .where("url")
        .equals(theURL)
        .modify({ visible: status });
      ipcRenderer.send("reload:mainWindow");
    }).catch(e => {
      console.error(e.stack);
    });
  });

  const colorWellIndex = `colorWell${i}`;
  const colorWell = document.getElementById(colorWellIndex);

  colorWell.addEventListener(
    "input",
    () => {
      const domainString =
        event.target.parentNode.parentNode.firstChild.innerHTML;
      const domainObj = parse(domainString);
      const trimmedDomain = domainObj.domain;
      const domainKey = trimmedDomain.replace(/\./g, "");
      // domainKey += '_page'; //to distinguish watched pages from rss domains

      store.set(domainKey, event.target.value);
      // console.log ('set ' + domainKey + ' to ' + event.target.value);
      ipcRenderer.send("reload:mainWindow");
    },
    false
  );
}

function deletePage(page) {
  console.log(page);
  console.log(typeof page);
  db.transaction("rw", db.pages, function*() {
    const deleteCount = yield db.pages
      .where("id")
      .equals(parseInt(page))
      .delete();

    console.log(`Successfully deleted ${deleteCount} page(s)`);
    // find link in array of objects
    const index = remote
      .getGlobal("pdb")
      .db.findIndex(x => x.id === parseInt(page));
    const tempPageList = remote.getGlobal("pdb").db;
    tempPageList.splice(index, 1);
    remote.getGlobal("pdb").db = tempPageList;
  }).catch(e => {
    console.error(e);
  });
}
