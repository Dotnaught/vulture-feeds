const electron = require('electron');
const {ipcRenderer} = electron;

const form = document.querySelector('form');
form.addEventListener('submit', submitForm);

function submitForm(e) {
  e.preventDefault();
  const page = document.querySelector('#page').value;
  const mode = document.querySelector('input[name = "selector"]:checked').value;

  //send to main.js
  ipcRenderer.send('item:addPage', page, mode);
}
