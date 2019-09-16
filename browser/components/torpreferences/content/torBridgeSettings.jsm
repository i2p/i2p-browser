"use strict";

var EXPORTED_SYMBOLS = [
  "TorBridgeSource",
  "TorBridgeSettings",
  "makeTorBridgeSettingsNone",
  "makeTorBridgeSettingsBuiltin",
  "makeTorBridgeSettingsBridgeDB",
  "makeTorBridgeSettingsUserProvided",
];

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
const { TorProtocolService } = ChromeUtils.import(
  "resource:///modules/TorProtocolService.jsm"
);
const { TorStrings } = ChromeUtils.import("resource:///modules/TorStrings.jsm");

const TorBridgeSource = {
  NONE: "NONE",
  BUILTIN: "BUILTIN",
  BRIDGEDB: "BRIDGEDB",
  USERPROVIDED: "USERPROVIDED",
};

class TorBridgeSettings {
  constructor() {
    this._bridgeSource = TorBridgeSource.NONE;
    this._selectedDefaultBridgeType = null;
    this._bridgeStrings = [];
  }

  get selectedDefaultBridgeType() {
    if (this._bridgeSource == TorBridgeSource.BUILTIN) {
      return this._selectedDefaultBridgeType;
    }
    return undefined;
  }

  get bridgeSource() {
    return this._bridgeSource;
  }

  // for display
  get bridgeStrings() {
    return this._bridgeStrings.join("\n");
  }

  // raw
  get bridgeStringsArray() {
    return this._bridgeStrings;
  }

  static get defaultBridgeTypes() {
    if (TorBridgeSettings._defaultBridgeTypes) {
      return TorBridgeSettings._defaultBridgeTypes;
    }

    let bridgeListBranch = Services.prefs.getBranch(
      TorStrings.preferenceBranches.defaultBridge
    );
    let bridgePrefs = bridgeListBranch.getChildList("", {});

    // an unordered set for shoving bridge types into
    let bridgeTypes = new Set();
    // look for keys ending in ".N" and treat string before that as the bridge type
    const pattern = /\.[0-9]+$/;
    for (const key of bridgePrefs) {
      const offset = key.search(pattern);
      if (offset != -1) {
        const bt = key.substring(0, offset);
        bridgeTypes.add(bt);
      }
    }

    // recommended bridge type goes first in the list
    let recommendedBridgeType = Services.prefs.getCharPref(
      TorStrings.preferenceKeys.recommendedBridgeType,
      null
    );

    let retval = [];
    if (recommendedBridgeType && bridgeTypes.has(recommendedBridgeType)) {
      retval.push(recommendedBridgeType);
    }

    for (const bridgeType of bridgeTypes.values()) {
      if (bridgeType != recommendedBridgeType) {
        retval.push(bridgeType);
      }
    }

    // cache off
    TorBridgeSettings._defaultBridgeTypes = retval;
    return retval;
  }

  _readDefaultBridges(aBridgeType) {
    let bridgeBranch = Services.prefs.getBranch(
      TorStrings.preferenceBranches.defaultBridge
    );
    let bridgeBranchPrefs = bridgeBranch.getChildList("", {});

    let retval = [];

    // regex matches against strings ending in ".N" where N is a positive integer
    let pattern = /\.[0-9]+$/;
    for (const key of bridgeBranchPrefs) {
      // verify the location of the match is the correct offset required for aBridgeType
      // to fit, and that the string begins with aBridgeType
      if (
        key.search(pattern) == aBridgeType.length &&
        key.startsWith(aBridgeType)
      ) {
        let bridgeStr = bridgeBranch.getCharPref(key);
        retval.push(bridgeStr);
      }
    }

    // fisher-yates shuffle
    // shuffle so that Tor Browser users don't all try the built-in bridges in the same order
    for (let i = retval.length - 1; i > 0; --i) {
      // number n such that 0.0 <= n < 1.0
      const n = Math.random();
      // integer j such that 0 <= j <= i
      const j = Math.floor(n * (i + 1));

      // swap values at indices i and j
      const tmp = retval[i];
      retval[i] = retval[j];
      retval[j] = tmp;
    }

    return retval;
  }

  _readBridgeDBBridges() {
    let bridgeBranch = Services.prefs.getBranch(
      `${TorStrings.preferenceBranches.bridgeDBBridges}`
    );
    let bridgeBranchPrefs = bridgeBranch.getChildList("", {});
    // the child prefs do not come in any particular order so sort the keys
    // so the values can be compared to what we get out off torrc
    bridgeBranchPrefs.sort();

    // just assume all of the prefs under the parent point to valid bridge string
    let retval = bridgeBranchPrefs.map(key =>
      bridgeBranch.getCharPref(key).trim()
    );

    return retval;
  }

  _readTorrcBridges() {
    let bridgeList = TorProtocolService.readStringArraySetting(
      TorStrings.configKeys.bridgeList
    );

    let retval = [];
    for (const line of bridgeList) {
      let trimmedLine = line.trim();
      if (trimmedLine) {
        retval.push(trimmedLine);
      }
    }

    return retval;
  }

  // analagous to initBridgeSettings()
  readSettings() {
    // restore to defaults
    this._bridgeSource = TorBridgeSource.NONE;
    this._selectedDefaultBridgeType = null;
    this._bridgeStrings = [];

    // So the way tor-launcher determines the origin of the configured bridges is a bit
    // weird and depends on inferring our scenario based on some firefox prefs and the
    // relationship between the saved list of bridges in about:config vs the list saved in torrc

    // first off, if "extensions.torlauncher.default_bridge_type" is set to one of our
    // builtin default types (obfs4, meek-azure, snowflake, etc) then we provide the
    // bridges in "extensions.torlauncher.default_bridge.*" (filtered by our default_bridge_type)

    // next, we compare the list of bridges saved in torrc to the bridges stored in the
    // "extensions.torlauncher.bridgedb_bridge."" branch. If they match *exactly* then we assume
    // the bridges were retrieved from BridgeDB and use those. If the torrc list is empty then we know
    // we have no bridge settings

    // finally, if none of the previous conditions are not met, it is assumed the bridges stored in
    // torrc are user-provided

    // what we should(?) do once we excise tor-launcher entirely is explicitly store an int/enum in
    // about:config that tells us which scenario we are in so we don't have to guess

    let defaultBridgeType = Services.prefs.getCharPref(
      TorStrings.preferenceKeys.defaultBridgeType,
      null
    );

    // check if source is BUILTIN
    if (defaultBridgeType) {
      this._bridgeStrings = this._readDefaultBridges(defaultBridgeType);
      this._bridgeSource = TorBridgeSource.BUILTIN;
      this._selectedDefaultBridgeType = defaultBridgeType;
      return;
    }

    let torrcBridges = this._readTorrcBridges();

    // no stored bridges means no bridge is in use
    if (torrcBridges.length == 0) {
      this._bridgeStrings = [];
      this._bridgeSource = TorBridgeSource.NONE;
      return;
    }

    let bridgedbBridges = this._readBridgeDBBridges();

    // if these two lists are equal then we got our bridges from bridgedb
    // ie: same element in identical order
    let arraysEqual = (left, right) => {
      if (left.length != right.length) {
        return false;
      }
      const length = left.length;
      for (let i = 0; i < length; ++i) {
        if (left[i] != right[i]) {
          return false;
        }
      }
      return true;
    };

    // agreement between prefs and torrc means bridgedb bridges
    if (arraysEqual(torrcBridges, bridgedbBridges)) {
      this._bridgeStrings = torrcBridges;
      this._bridgeSource = TorBridgeSource.BRIDGEDB;
      return;
    }

    // otherwise they must be user provided
    this._bridgeStrings = torrcBridges;
    this._bridgeSource = TorBridgeSource.USERPROVIDED;
  }

  writeSettings() {
    let settingsObject = new Map();

    // init tor bridge settings to null
    settingsObject.set(TorStrings.configKeys.useBridges, null);
    settingsObject.set(TorStrings.configKeys.bridgeList, null);

    // clear bridge related firefox prefs
    Services.prefs.setCharPref(TorStrings.preferenceKeys.defaultBridgeType, "");
    let bridgeBranch = Services.prefs.getBranch(
      `${TorStrings.preferenceBranches.bridgeDBBridges}`
    );
    let bridgeBranchPrefs = bridgeBranch.getChildList("", {});
    for (const pref of bridgeBranchPrefs) {
      Services.prefs.clearUserPref(
        `${TorStrings.preferenceBranches.bridgeDBBridges}${pref}`
      );
    }

    switch (this._bridgeSource) {
      case TorBridgeSource.BUILTIN:
        // set builtin bridge type to use in prefs
        Services.prefs.setCharPref(
          TorStrings.preferenceKeys.defaultBridgeType,
          this._selectedDefaultBridgeType
        );
        break;
      case TorBridgeSource.BRIDGEDB:
        // save bridges off to prefs
        for (let i = 0; i < this.bridgeStringsArray.length; ++i) {
          Services.prefs.setCharPref(
            `${TorStrings.preferenceBranches.bridgeDBBridges}${i}`,
            this.bridgeStringsArray[i]
          );
        }
        break;
    }

    // write over our bridge list if bridges are enabled
    if (this._bridgeSource != TorBridgeSource.NONE) {
      settingsObject.set(TorStrings.configKeys.useBridges, true);
      settingsObject.set(
        TorStrings.configKeys.bridgeList,
        this.bridgeStringsArray
      );
    }
    TorProtocolService.writeSettings(settingsObject);
  }
}

function makeTorBridgeSettingsNone() {
  return new TorBridgeSettings();
}

function makeTorBridgeSettingsBuiltin(aBridgeType) {
  let retval = new TorBridgeSettings();
  retval._bridgeSource = TorBridgeSource.BUILTIN;
  retval._selectedDefaultBridgeType = aBridgeType;
  retval._bridgeStrings = retval._readDefaultBridges(aBridgeType);

  return retval;
}

function makeTorBridgeSettingsBridgeDB(aBridges) {
  let retval = new TorBridgeSettings();
  retval._bridgeSource = TorBridgeSource.BRIDGEDB;
  retval._selectedDefaultBridgeType = null;
  retval._bridgeStrings = aBridges;

  return retval;
}

function makeTorBridgeSettingsUserProvided(aBridges) {
  let retval = new TorBridgeSettings();
  retval._bridgeSource = TorBridgeSource.USERPROVIDED;
  retval._selectedDefaultBridgeType = null;
  retval._bridgeStrings = aBridges;

  return retval;
}
