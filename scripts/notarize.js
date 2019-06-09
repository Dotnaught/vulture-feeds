//require('dotenv').config();
const { notarize } = require('electron-notarize');

exports.default = async function notarizing(context) {
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const { electronPlatformName, appOutDir } = context;
  const appName = context.packager.appInfo.productFilename;

  return await notarize({
    appBundleId: 'com.yourcompany.yourAppId',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLEID,
    appleIdPassword: process.env.APPLEIDPASS,
  });
};