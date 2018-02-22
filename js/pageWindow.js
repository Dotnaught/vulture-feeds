const electron = require('electron');
const {ipcRenderer, remote} = electron;
const ul = document.querySelector('ul');
const db = require('../js/mydatabase');

const Config = require('electron-config');
const config = new Config();

const { parse } = require('tldjs');


console.log(remote.getGlobal('pdb').db);
let pageList = remote.getGlobal('pdb').db;

let colorWell;
const defaultColor = '#039be5';


for (var i = 0; i < pageList.length; i++){
    console.log('id = ' + pageList[i].id);
    
	if (remote.getGlobal('pdb').db[i].visible){
		console.log("Visible " + remote.getGlobal('pdb').db[i].visible);
	} else {
		console.log("Not visible " + remote.getGlobal('pdb').db[i].visible);
	}
    
	ul.className = 'collection';
    const li = document.createElement('li');
    li.className = 'collection-item';

    const itemText = document.createTextNode(pageList[i].url);

    const a = document.createElement('a');
    a.appendChild(itemText);
    a.setAttribute('id', i);
    a.setAttribute('href', '#');
    
    a.addEventListener('click', function(){
    	console.log('Trying to delete feed ' + this.innerHTML);
    	//remove from db
    	let thisFeed = this.innerHTML;
    	deleteItem(thisFeed);
    	//remove from feedWindow
		this.parentNode.parentNode.removeChild(a.parentNode);
    });
    
    li.appendChild(a);
    ul.appendChild(li);
    
    let colorObj = parse(pageList[i].url);
    let trimmedColorObj = colorObj.domain;
    let colorKey = trimmedColorObj.replace(/\./g, "");
    let setColor = config.get(colorKey, defaultColor);

    //The beforebegin and afterend positions work only if the node is in the DOM tree and has a parent element.
    if (pageList[i].visible){
    	a.insertAdjacentHTML('afterend', `<div class="switch">
                                            <label>Off<input id="s${i}" type="checkbox" checked>
                                            <span class="lever"></span>On</label>
                                            <label style="margin-left:2.5em" for="colorWell${i}">Color:</label>
                                            <input style="margin-left:0.5em" id="colorWell${i}" type="color" value="${setColor}">
                                            <label style="margin-left:2.5em">Mode: ${remote.getGlobal('pdb').db[i].mode}</label>
                                            </div>`
                            );
	} else {
		a.insertAdjacentHTML('afterend', `<div class="switch">
                                            <label>Off<input id="s${i}" type="checkbox">
                                            <span class="lever"></span>On</label>
                                            <label style="margin-left:2.5em" for="colorWell${i}">Color:</label>
                                            <input style="margin-left:0.5em" id="colorWell${i}" type="color" value="${setColor}">
                                            <label style="margin-left:2.5em">Mode: ${remote.getGlobal('pdb').db[i].mode}</label>
                                            </div>`
                            );	
	}
    //get ID of db entry, use checked or unchecked as appropriate
    let switchIndex = "s" + i;
    //console.log(switchIndex);
    let lever = document.getElementById(switchIndex);
  
    lever.addEventListener('change', function() {
    	//console.log(switchIndex + ' ' + this.checked);
    	//console.log(this.parentNode.parentNode.parentNode.firstChild.innerHTML);
    	let theURL = this.parentNode.parentNode.parentNode.firstChild.innerHTML;
    	let status = this.checked ? 1 : 0;
    	
    	db.transaction('rw', db.pages, function*() {
	    	yield db.pages.where('url').equals(theURL).modify({visible: status});
            ipcRenderer.send('reload:mainWindow');

    	}).catch(e => {
    		console.error (e.stack);
		});

    });

    let colorWellIndex = "colorWell" + i;
    let colorWell = document.getElementById(colorWellIndex);

    colorWell.addEventListener("input", function() {
        
        let domainString = event.target.parentNode.parentNode.firstChild.innerHTML;
        let domainObj = parse(domainString);
        let trimmedDomain = domainObj.domain;
        let domainKey = trimmedDomain.replace(/\./g, "");
        //domainKey += '_page'; //to distinguish watched pages from rss domains
        
        config.set(domainKey, event.target.value);
        //console.log ('set ' + domainKey + ' to ' + event.target.value);
        ipcRenderer.send('reload:mainWindow');
    }, false);

};



function deleteItem(page){
		db.transaction('rw', db.pages, function* () {
	    var deleteCount = yield db.pages
	        .where("url").equals(page)
	        .delete();

	    console.log ("Successfully deleted " + deleteCount + " item(s)");
	    //find link in array of objects
	    let index = remote.getGlobal('pdb').db.findIndex(x => x.url===page);
	    let tempPageList = remote.getGlobal('pdb').db;
	   	tempPageList.splice(index, 1);
	   	remote.getGlobal('pdb').db = tempPageList;
	   	
	}).catch (e => {
	    console.error (e);
	});
}

