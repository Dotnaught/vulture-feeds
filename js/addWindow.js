const electron = require('electron');
const {ipcRenderer} = electron;

const form = document.querySelector('form');
form.addEventListener('submit', submitForm);

function submitForm(e){
	e.preventDefault();
	const item = document.querySelector('#item').value;
	ipcRenderer.send('item:addFeed', item);
}