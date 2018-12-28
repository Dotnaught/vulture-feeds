const electron = require('electron');
const {ipcRenderer} = electron;

const form = document.querySelector('form');
form.addEventListener('submit', submitForm);

function submitForm(e) {
  e.preventDefault();
  const repo = document.querySelector('#repo').value;
  const mode = document.querySelector('input[name = "selector"]:checked').value;

  //send to main.js
  //+id,owner,repo,issue,timeChecked,issueCommentCount,repoCommentCount'
  ipcRenderer.send('item:addRepo', repo, mode);
}
