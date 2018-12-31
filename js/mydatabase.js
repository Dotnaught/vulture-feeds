const Dexie = require('dexie');

const db = new Dexie('urlDatabase');
db.version(1).stores({
  urls: '++id,rssLink,timeChecked,visible',
  pages: '++id,url,timeChecked,hash,linkHash,mode,visible',
});
db.version(2).stores({
  urls: '++id,rssLink,timeChecked,visible,filterList',
  pages: '++id,url,timeChecked,hash,linkHash,mode,visible',
});


module.exports = db;
