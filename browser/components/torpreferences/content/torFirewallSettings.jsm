"use strict";

var EXPORTED_SYMBOLS = [
  "TorFirewallSettings",
  "makeTorFirewallSettingsNone",
  "makeTorFirewallSettingsCustom",
];

const { TorProtocolService } = ChromeUtils.import(
  "resource:///modules/TorProtocolService.jsm"
);
const { TorStrings } = ChromeUtils.import("resource:///modules/TorStrings.jsm");
const { parseAddrPortList } = ChromeUtils.import(
  "chrome://browser/content/torpreferences/parseFunctions.jsm"
);

class TorFirewallSettings {
  constructor() {
    this._allowedPorts = [];
  }

  get portsConfigurationString() {
    let portStrings = this._allowedPorts.map(port => `*:${port}`);
    return portStrings.join(",");
  }

  get commaSeparatedListString() {
    return this._allowedPorts.join(",");
  }

  get hasPorts() {
    return this._allowedPorts.length > 0;
  }

  readSettings() {
    let addressPortList = TorProtocolService.readStringSetting(
      TorStrings.configKeys.reachableAddresses
    );

    let allowedPorts = [];
    if (addressPortList) {
      allowedPorts = parseAddrPortList(addressPortList);
    }
    this._allowedPorts = allowedPorts;
  }

  writeSettings() {
    let settingsObject = new Map();

    // init to null so Tor daemon resets if no ports
    settingsObject.set(TorStrings.configKeys.reachableAddresses, null);

    if (this._allowedPorts.length > 0) {
      settingsObject.set(
        TorStrings.configKeys.reachableAddresses,
        this.portsConfigurationString
      );
    }

    TorProtocolService.writeSettings(settingsObject);
  }
}

function makeTorFirewallSettingsNone() {
  return new TorFirewallSettings();
}

function makeTorFirewallSettingsCustom(aPortsList) {
  let retval = new TorFirewallSettings();
  retval._allowedPorts = aPortsList;
  return retval;
}
