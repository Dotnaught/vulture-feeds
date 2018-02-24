# vulture-feeds

vulture-feeds is an Electron-based RSS/Atom headline aggregator for journalists. It's designed for finding recently published news and source documents; it's not intended for reading articles.

Because I currently write for The Register, vulture-feeds is configured for finding tech news. But it can be adapted for other areas of interest.

The app has been setup to ingest some sources that require customization, because RSS and ATOM implementations aren't uniform. At some point, it may include more of these. Feel free to customize it to meet your needs.

For its initial release, the app includes two main functions: RSS/Atom feed aggregation and webpage monitoring.

Webpage monitoring is done by comparing hashes of the network response to a request for the page. While hash comparison is easy to implement it's not the optimal approach because even the smallest change will be detected. Monitoring a specific page element is more reliable but also more brittle, requiring code changes if the page structure is revised.

<img alt="vulture-feeds-screenshot" src="https://user-images.githubusercontent.com/429084/36622694-90e4dd1a-18b3-11e8-9076-e1e344f825ab.png" style="max-width:100%;">

### Prerequisites

To build vulture-feeds, Node.js is required. It's been tested with v8.9.1.

```
Node.js
```

### Installing

To get started:

```
git clone https://github.com/Dotnaught/vulture-feeds.git
cd vulture-feeds
npm install
npm start
```

The app should present a blank page on startup. It comes with some default feeds, which can be loaded via Files > Load Defaults. Or add feeds individually via Files > Add Feed.

## Deployment

To build vulture-feeds as a desktop app, run the script for the appropriate platform and, if all goes well, the app will be available in the release-builds folder. See the Electron docs (https://www.electron.build/multi-platform-build). 

```
npm run package-mac
```

```
npm run package-win
```

```
npm run package-linux
```

The default configuration includes the Developer Tools menu. To disable it, change process.env.NODE_ENV from 'development' setting to 'production' at the top of the main.js file.

```
process.env.NODE_ENV = 'production';
```

To sign vulture-feeds with an Apple Developer ID, replace dummy text below with the name of your Apple Developer ID Certificate, which should be visible in the macOS Keychain app. Run these commands in the directory with the app build (e.g., vulture-feeds-darwin-x64).

```
codesign --deep --force --verbose --sign "Developer ID Application: YOUR_DEV_ID (xxxxxxxxx)" vulture-feeds.app
codesign --verify -vvvv vulture-feeds.app
spctl -a -vvvv vulture-feeds.app
```

## Built With

* [Electron](https://electronjs.org/) - Cross-platform app framework
* [Dexie](http://dexie.org/) - IndexDB
* [Materialize](http://materializecss.com/) - HTML/CSS design 

## Notes

* vulture-feeds depends upon [hnrss](https://edavis.github.io/hnrss/) to extend the Hacker News RSS feed. If that feed should become unavailable, the hnrss code (https://github.com/edavis/hnrss) will need to be deployed somewhere and the feed URL will need to be fixed in the app.

* Changes to the Dexie database schema may cause problems. If the app fails to store data or throws related errors, try deleting the IndexDB instance named 'urlDatabase' via (Chrome) Developer Tools -> Application -> Storage -> IndexDB. Or just select 'Delete Database' from the File menu.

## Authors

* **Thomas Claburn** - *Version 1.0* - [Dotnaught](https://github.com/Dotnaught)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details

## Acknowledgments

* For introducing me to Electron: http://traversymedia.com/
