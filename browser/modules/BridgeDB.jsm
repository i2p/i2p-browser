"use strict";

var EXPORTED_SYMBOLS = ["BridgeDB"];

const { TorLauncherBridgeDB } = ChromeUtils.import(
  "resource://torlauncher/modules/tl-bridgedb.jsm"
);
const { TorProtocolService } = ChromeUtils.import(
  "resource:///modules/TorProtocolService.jsm"
);
const { TorStrings } = ChromeUtils.import("resource:///modules/TorStrings.jsm");

var BridgeDB = {
  _moatRequestor: null,
  _currentCaptchaInfo: null,
  _bridges: null,

  get currentCaptchaImage() {
    if (this._currentCaptchaInfo) {
      return this._currentCaptchaInfo.captchaImage;
    }
    return null;
  },

  get currentBridges() {
    return this._bridges;
  },

  submitCaptchaGuess(aCaptchaSolution) {
    if (this._moatRequestor && this._currentCaptchaInfo) {
      return this._moatRequestor
        .finishFetch(
          this._currentCaptchaInfo.transport,
          this._currentCaptchaInfo.challenge,
          aCaptchaSolution
        )
        .then(aBridgeInfo => {
          this._moatRequestor.close();
          this._moatRequestor = null;
          this._currentCaptchaInfo = null;
          this._bridges = aBridgeInfo.bridges;
          // array of bridge strings
          return this._bridges;
        });
    }

    return new Promise((aResponse, aReject) => {
      aReject(new Error("Invalid _moatRequestor or _currentCaptchaInfo"));
    });
  },

  requestNewCaptchaImage(aProxyURI) {
    // close and clear out existing state on captcha request
    this.close();

    let transportPlugins = TorProtocolService.readStringArraySetting(
      TorStrings.configKeys.clientTransportPlugin
    );

    let meekClientPath;
    let meekTransport; // We support both "meek" and "meek_lite".
    let meekClientArgs;
    // TODO: shouldn't this early out once meek settings are found?
    for (const line of transportPlugins) {
      // Parse each ClientTransportPlugin line and look for the meek or
      // meek_lite transport. This code works a lot like the Tor daemon's
      // parse_transport_line() function.
      let tokens = line.split(" ");
      if (tokens.length > 2 && tokens[1] == "exec") {
        let transportArray = tokens[0].split(",").map(aStr => aStr.trim());
        let transport = transportArray.find(
          aTransport => aTransport === "meek"
        );
        if (!transport) {
          transport = transportArray.find(
            aTransport => aTransport === "meek_lite"
          );
        }
        if (transport) {
          meekTransport = transport;
          meekClientPath = tokens[2];
          meekClientArgs = tokens.slice(3);
        }
      }
    }

    this._moatRequestor = TorLauncherBridgeDB.createMoatRequestor();

    return this._moatRequestor
      .init(aProxyURI, meekTransport, meekClientPath, meekClientArgs)
      .then(() => {
        // TODO: get this from TorLauncherUtil
        let bridgeType = "obfs4";
        return this._moatRequestor.fetchBridges([bridgeType]);
      })
      .then(aCaptchaInfo => {
        // cache off the current captcha info as the challenge is needed for response
        this._currentCaptchaInfo = aCaptchaInfo;
        return aCaptchaInfo.captchaImage;
      });
  },

  close() {
    if (this._moatRequestor) {
      this._moatRequestor.close();
      this._moatRequestor = null;
    }
    this._currentCaptchaInfo = null;
  },
};
