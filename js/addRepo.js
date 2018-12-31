const electron = require('electron');
const {ipcRenderer} = electron;

const form = document.querySelector('form');
form.addEventListener('submit', submitForm);

function submitForm(e) {
  e.preventDefault();
  const repoURL = document.querySelector('#repo').value;
  const keywords = document.querySelector('#keywords').value;

  //send to main.js
  //+id,owner,repo
  ipcRenderer.send('item:addRepo', repoURL, keywords); //mode
}
