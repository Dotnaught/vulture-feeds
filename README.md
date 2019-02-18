# vulture-feeds

vulture-feeds is an Electron-based RSS/Atom headline aggregator for journalists. It's designed for finding recently published news and source documents; it's not intended for reading articles.

Because I currently write for The Register, vulture-feeds is configured for finding tech news. But it can be adapted for other areas of interest.

The app has been setup to ingest some sources that require customization, because RSS and ATOM implementations aren't uniform. At some point, it may include more of these. Feel free to customize it to meet your needs.

Initially, the app included two main functions: RSS/Atom feed aggregation and webpage monitoring. As of version 1.0.3, it also supports keyword search filtering on displayed article links (to show fewer fetched links) and on article links prior to display (as a way of keeping feeds with lots of entries manageable). 

The former filtering capability is available through the Search box at the top of the main page. The latter can be set from the File > Show Feeds menu and was intended for use on US court feeds, so a specific case can be followed while others are ignored and not loaded.

Webpage monitoring is done by comparing hashes of the network response to a request for the page. While hash comparison is easy to implement it's not the optimal approach because even the smallest change will be detected. Monitoring a specific page element is more reliable but also more brittle, requiring code changes if the page structure is revised.

Version 1.0.4 introduced the ability to track GitHub repos. Version 1.0.5 adds some changes to the way repos are handled: It looks at the last 30 days of Issues posts in selected repos and surfaces either all Issues modified since then or those that include body text matching keywords set when the repo feed was added. There are probably better ways to approach this. Future revisions may change this further.

<img alt="vulture-feeds-screenshot" src="https://user-images.githubusercontent.com/429084/36622694-90e4dd1a-18b3-11e8-9076-e1e344f825ab.png" style="max-width:100%;">

### Prerequisites

To build vulture-feeds, Node.js is required. It's been tested with v10.15.0.

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

To build vulture-feeds as a desktop app, run the script for the appropriate platform and, if all goes well, the app will be available in the release-builds folder. Initially, vulture-feeds relied on electron-packager. Currently, it also implements electron-builder, which can build for macOS as follows:

```
npm run dist
```

Or to also build for Windows and Linux:

```
npm run distw
```

See the package.json file for other scripts.

The default configuration includes the Developer Tools menu. To disable it, change process.env.NODE_ENV from 'development' setting to 'production' at the top of the main.js file.

```
process.env.NODE_ENV = 'production';
```

To sign vulture-feeds with an Apple Developer ID using electron-packager, replace dummy text below with the name of your Apple Developer ID Certificate, which should be visible in the macOS Keychain app. Run these commands in the directory with the app build (e.g., vulture-feeds-darwin-x64).

```
codesign --deep --force --verbose --sign "Developer ID Application: YOUR_DEV_ID (xxxxxxxxx)" vulture-feeds.app
codesign --verify -vvvv vulture-feeds.app
spctl -a -vvvv vulture-feeds.app
```
In electron-builder, this should not be necessary.

## Built With

* [Electron](https://electronjs.org/) - Cross-platform app framework
* [Dexie](https://dexie.org/) - IndexDB
* [Materialize](https://materializecss.com/) - HTML/CSS design 

## Notes

* vulture-feeds depends upon [hnrss](https://edavis.github.io/hnrss/) to extend the Hacker News RSS feed. If that feed should become unavailable, the hnrss code (https://github.com/edavis/hnrss) will need to be deployed somewhere and the feed URL will need to be fixed in the app.

* Changes to the Dexie database schema may cause problems. If the app fails to store data or throws related errors, try deleting the IndexDB instance named 'urlDatabase' via (Chrome) Developer Tools -> Application -> Storage -> IndexDB. Or just select 'Delete Database' from the File menu.

## Authors

* **Thomas Claburn** - *Version 1.0.5* - [Dotnaught](https://github.com/Dotnaught)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details
