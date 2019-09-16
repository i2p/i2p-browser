"use strict";

var EXPORTED_SYMBOLS = ["TorProtocolService"];

const { TorLauncherUtil } = ChromeUtils.import(
  "resource://torlauncher/modules/tl-util.jsm"
);

var TorProtocolService = {
  _tlps: Cc["@torproject.org/torlauncher-protocol-service;1"].getService(
    Ci.nsISupports
  ).wrappedJSObject,

  // maintain a map of tor settings set by Tor Browser so that we don't
  // repeatedly set the same key/values over and over
  // this map contains string keys to primitive or array values
  _settingsCache: new Map(),

  _typeof(aValue) {
    switch (typeof aValue) {
      case "boolean":
        return "boolean";
      case "string":
        return "string";
      case "object":
        if (aValue == null) {
          return "null";
        } else if (Array.isArray(aValue)) {
          return "array";
        }
        return "object";
    }
    return "unknown";
  },

  _assertValidSettingKey(aSetting) {
    // ensure the 'key' is a string
    if (typeof aSetting != "string") {
      throw new Error(
        `Expected setting of type string but received ${typeof aSetting}`
      );
    }
  },

  _assertValidSetting(aSetting, aValue) {
    this._assertValidSettingKey(aSetting);

    const valueType = this._typeof(aValue);
    switch (valueType) {
      case "boolean":
      case "string":
      case "null":
        return;
      case "array":
        for (const element of aValue) {
          if (typeof element != "string") {
            throw new Error(
              `Setting '${aSetting}' array contains value of invalid type '${typeof element}'`
            );
          }
        }
        return;
      default:
        throw new Error(
          `Invalid object type received for setting '${aSetting}'`
        );
    }
  },

  // takes a Map containing tor settings
  // throws on error
  writeSettings(aSettingsObj) {
    // only write settings that have changed
    let newSettings = new Map();
    for (const [setting, value] of aSettingsObj) {
      let saveSetting = false;

      // make sure we have valid data here
      this._assertValidSetting(setting, value);

      if (!this._settingsCache.has(setting)) {
        // no cached setting, so write
        saveSetting = true;
      } else {
        const cachedValue = this._settingsCache.get(setting);
        if (value != cachedValue) {
          // compare arrays member-wise
          if (Array.isArray(value) && Array.isArray(cachedValue)) {
            if (value.length != cachedValue.length) {
              saveSetting = true;
            } else {
              const arrayLength = value.length;
              for (let i = 0; i < arrayLength; ++i) {
                if (value[i] != cachedValue[i]) {
                  saveSetting = true;
                  break;
                }
              }
            }
          } else {
            // some other different values
            saveSetting = true;
          }
        }
      }

      if (saveSetting) {
        newSettings.set(setting, value);
      }
    }

    // only write if new setting to save
    if (newSettings.size > 0) {
      // convert settingsObject map to js object for torlauncher-protocol-service
      let settingsObject = {};
      for (const [setting, value] of newSettings) {
        settingsObject[setting] = value;
      }

      let errorObject = {};
      if (!this._tlps.TorSetConfWithReply(settingsObject, errorObject)) {
        throw new Error(errorObject.details);
      }

      // save settings to cache after successfully writing to Tor
      for (const [setting, value] of newSettings) {
        this._settingsCache.set(setting, value);
      }
    }
  },

  _readSetting(aSetting) {
    this._assertValidSettingKey(aSetting);
    let reply = this._tlps.TorGetConf(aSetting);
    if (this._tlps.TorCommandSucceeded(reply)) {
      return reply.lineArray;
    }
    throw new Error(reply.lineArray.join("\n"));
  },

  _readBoolSetting(aSetting) {
    let lineArray = this._readSetting(aSetting);
    if (lineArray.length != 1) {
      throw new Error(
        `Expected an array with length 1 but received array of length ${
          lineArray.length
        }`
      );
    }

    let retval = lineArray[0];
    switch (retval) {
      case "0":
        return false;
      case "1":
        return true;
      default:
        throw new Error(`Expected boolean (1 or 0) but received '${retval}'`);
    }
  },

  _readStringSetting(aSetting) {
    let lineArray = this._readSetting(aSetting);
    if (lineArray.length != 1) {
      throw new Error(
        `Expected an array with length 1 but received array of length ${
          lineArray.length
        }`
      );
    }
    return lineArray[0];
  },

  _readStringArraySetting(aSetting) {
    let lineArray = this._readSetting(aSetting);
    return lineArray;
  },

  readBoolSetting(aSetting) {
    let value = this._readBoolSetting(aSetting);
    this._settingsCache.set(aSetting, value);
    return value;
  },

  readStringSetting(aSetting) {
    let value = this._readStringSetting(aSetting);
    this._settingsCache.set(aSetting, value);
    return value;
  },

  readStringArraySetting(aSetting) {
    let value = this._readStringArraySetting(aSetting);
    this._settingsCache.set(aSetting, value);
    return value;
  },

  // writes current tor settings to disk
  flushSettings() {
    this._tlps.TorSendCommand("SAVECONF");
  },

  getLog() {
    let countObj = { value: 0 };
    let torLog = this._tlps.TorGetLog(countObj);
    return torLog;
  },

  // true if we launched and control tor, false if using system tor
  get ownsTorDaemon() {
    return TorLauncherUtil.shouldStartAndOwnTor;
  },
};
