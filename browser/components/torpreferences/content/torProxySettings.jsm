"use strict";

var EXPORTED_SYMBOLS = [
  "TorProxyType",
  "TorProxySettings",
  "makeTorProxySettingsNone",
  "makeTorProxySettingsSocks4",
  "makeTorProxySettingsSocks5",
  "makeTorProxySettingsHTTPS",
];

const { TorProtocolService } = ChromeUtils.import(
  "resource:///modules/TorProtocolService.jsm"
);
const { TorStrings } = ChromeUtils.import("resource:///modules/TorStrings.jsm");
const { parseAddrPort, parseUsernamePassword } = ChromeUtils.import(
  "chrome://browser/content/torpreferences/parseFunctions.jsm"
);

const TorProxyType = {
  NONE: "NONE",
  SOCKS4: "SOCKS4",
  SOCKS5: "SOCKS5",
  HTTPS: "HTTPS",
};

class TorProxySettings {
  constructor() {
    this._proxyType = TorProxyType.NONE;
    this._proxyAddress = undefined;
    this._proxyPort = undefined;
    this._proxyUsername = undefined;
    this._proxyPassword = undefined;
  }

  get type() {
    return this._proxyType;
  }
  get address() {
    return this._proxyAddress;
  }
  get port() {
    return this._proxyPort;
  }
  get username() {
    return this._proxyUsername;
  }
  get password() {
    return this._proxyPassword;
  }
  get proxyURI() {
    switch (this._proxyType) {
      case TorProxyType.SOCKS4:
        return `socks4a://${this._proxyAddress}:${this._proxyPort}`;
      case TorProxyType.SOCKS5:
        if (this._proxyUsername) {
          return `socks5://${this._proxyUsername}:${this._proxyPassword}@${
            this._proxyAddress
          }:${this._proxyPort}`;
        }
        return `socks5://${this._proxyAddress}:${this._proxyPort}`;
      case TorProxyType.HTTPS:
        if (this._proxyUsername) {
          return `http://${this._proxyUsername}:${this._proxyPassword}@${
            this._proxyAddress
          }:${this._proxyPort}`;
        }
        return `http://${this._proxyAddress}:${this._proxyPort}`;
    }
    return undefined;
  }

  // attempts to read proxy settings from Tor daemon
  readSettings() {
    // SOCKS4
    {
      let addressPort = TorProtocolService.readStringSetting(
        TorStrings.configKeys.socks4Proxy
      );
      if (addressPort) {
        // address+port
        let [proxyAddress, proxyPort] = parseAddrPort(addressPort);

        this._proxyType = TorProxyType.SOCKS4;
        this._proxyAddress = proxyAddress;
        this._proxyPort = proxyPort;
        this._proxyUsername = "";
        this._proxyPassword = "";

        return;
      }
    }

    // SOCKS5
    {
      let addressPort = TorProtocolService.readStringSetting(
        TorStrings.configKeys.socks5Proxy
      );

      if (addressPort) {
        // address+port
        let [proxyAddress, proxyPort] = parseAddrPort(addressPort);
        // username
        let proxyUsername = TorProtocolService.readStringSetting(
          TorStrings.configKeys.socks5ProxyUsername
        );
        // password
        let proxyPassword = TorProtocolService.readStringSetting(
          TorStrings.configKeys.socks5ProxyPassword
        );

        this._proxyType = TorProxyType.SOCKS5;
        this._proxyAddress = proxyAddress;
        this._proxyPort = proxyPort;
        this._proxyUsername = proxyUsername;
        this._proxyPassword = proxyPassword;

        return;
      }
    }

    // HTTP
    {
      let addressPort = TorProtocolService.readStringSetting(
        TorStrings.configKeys.httpsProxy
      );

      if (addressPort) {
        // address+port
        let [proxyAddress, proxyPort] = parseAddrPort(addressPort);

        // username:password
        let proxyAuthenticator = TorProtocolService.readStringSetting(
          TorStrings.configKeys.httpsProxyAuthenticator
        );

        let [proxyUsername, proxyPassword] = ["", ""];
        if (proxyAuthenticator) {
          [proxyUsername, proxyPassword] = parseUsernamePassword(
            proxyAuthenticator
          );
        }

        this._proxyType = TorProxyType.HTTPS;
        this._proxyAddress = proxyAddress;
        this._proxyPort = proxyPort;
        this._proxyUsername = proxyUsername;
        this._proxyPassword = proxyPassword;
      }
    }
    // no proxy settings
  } /* TorProxySettings::ReadFromTor() */

  // attempts to write proxy settings to Tor daemon
  // throws on error
  writeSettings() {
    let settingsObject = new Map();

    // init proxy related settings to null so Tor daemon resets them
    settingsObject.set(TorStrings.configKeys.socks4Proxy, null);
    settingsObject.set(TorStrings.configKeys.socks5Proxy, null);
    settingsObject.set(TorStrings.configKeys.socks5ProxyUsername, null);
    settingsObject.set(TorStrings.configKeys.socks5ProxyPassword, null);
    settingsObject.set(TorStrings.configKeys.httpsProxy, null);
    settingsObject.set(TorStrings.configKeys.httpsProxyAuthenticator, null);

    switch (this._proxyType) {
      case TorProxyType.SOCKS4:
        settingsObject.set(
          TorStrings.configKeys.socks4Proxy,
          `${this._proxyAddress}:${this._proxyPort}`
        );
        break;
      case TorProxyType.SOCKS5:
        settingsObject.set(
          TorStrings.configKeys.socks5Proxy,
          `${this._proxyAddress}:${this._proxyPort}`
        );
        settingsObject.set(
          TorStrings.configKeys.socks5ProxyUsername,
          this._proxyUsername
        );
        settingsObject.set(
          TorStrings.configKeys.socks5ProxyPassword,
          this._proxyPassword
        );
        break;
      case TorProxyType.HTTPS:
        settingsObject.set(
          TorStrings.configKeys.httpsProxy,
          `${this._proxyAddress}:${this._proxyPort}`
        );
        settingsObject.set(
          TorStrings.configKeys.httpsProxyAuthenticator,
          `${this._proxyUsername}:${this._proxyPassword}`
        );
        break;
    }

    TorProtocolService.writeSettings(settingsObject);
  } /* TorProxySettings::WriteToTor() */
}

// factory methods for our various supported proxies
function makeTorProxySettingsNone() {
  return new TorProxySettings();
}

function makeTorProxySettingsSocks4(aProxyAddress, aProxyPort) {
  let retval = new TorProxySettings();
  retval._proxyType = TorProxyType.SOCKS4;
  retval._proxyAddress = aProxyAddress;
  retval._proxyPort = aProxyPort;
  return retval;
}

function makeTorProxySettingsSocks5(
  aProxyAddress,
  aProxyPort,
  aProxyUsername,
  aProxyPassword
) {
  let retval = new TorProxySettings();
  retval._proxyType = TorProxyType.SOCKS5;
  retval._proxyAddress = aProxyAddress;
  retval._proxyPort = aProxyPort;
  retval._proxyUsername = aProxyUsername;
  retval._proxyPassword = aProxyPassword;
  return retval;
}

function makeTorProxySettingsHTTPS(
  aProxyAddress,
  aProxyPort,
  aProxyUsername,
  aProxyPassword
) {
  let retval = new TorProxySettings();
  retval._proxyType = TorProxyType.HTTPS;
  retval._proxyAddress = aProxyAddress;
  retval._proxyPort = aProxyPort;
  retval._proxyUsername = aProxyUsername;
  retval._proxyPassword = aProxyPassword;
  return retval;
}
