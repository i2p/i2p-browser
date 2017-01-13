/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/* import-globals-from aboutDialog-appUpdater.js */

// Services = object with smart getters for common XPCOM services
ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource://gre/modules/AppConstants.jsm");

#ifdef TOR_BROWSER_VERSION
# Add double-quotes back on (stripped by JarMaker.py).
#expand const TOR_BROWSER_VERSION = "__TOR_BROWSER_VERSION__";
#endif

function init(aEvent) {
  if (aEvent.target != document)
    return;

  var distroId = Services.prefs.getCharPref("distribution.id", "");
  if (distroId) {
    var distroString = distroId;

    var distroVersion = Services.prefs.getCharPref("distribution.version", "");
    if (distroVersion) {
      distroString += " - " + distroVersion;
    }

    var distroIdField = document.getElementById("distributionId");
    distroIdField.value = distroString;
    distroIdField.style.display = "block";

    var distroAbout = Services.prefs.getStringPref("distribution.about", "");
    if (distroAbout) {
      var distroField = document.getElementById("distribution");
      distroField.value = distroAbout;
      distroField.style.display = "block";
    }
  }

  // Include the build ID and display warning if this is an "a#" (nightly or aurora) build
  let versionField = document.getElementById("version");
  versionField.textContent = AppConstants.MOZ_APP_VERSION_DISPLAY;
  let version = Services.appinfo.version;
  if (/a\d+$/.test(version)) {
    document.getElementById("experimental").hidden = false;
    document.getElementById("communityDesc").hidden = true;
  }

#ifdef TOR_BROWSER_VERSION
  versionField.textContent = TOR_BROWSER_VERSION +
                             " (based on Mozilla Firefox " +
                             versionField.textContent + ")";
#endif

  // Append "(32-bit)" or "(64-bit)" build architecture to the version number:
  let bundle = Services.strings.createBundle("chrome://browser/locale/browser.properties");
  let archResource = Services.appinfo.is64Bit
                     ? "aboutDialog.architecture.sixtyFourBit"
                     : "aboutDialog.architecture.thirtyTwoBit";
  let arch = bundle.GetStringFromName(archResource);
  versionField.textContent += ` (${arch})`;

  // Show a release notes link if we have a URL.
  let relNotesLink = document.getElementById("releasenotes");
  let relNotesPrefType = Services.prefs.getPrefType("app.releaseNotesURL");
  if (relNotesPrefType != Services.prefs.PREF_INVALID) {
    let relNotesURL = Services.urlFormatter.formatURLPref("app.releaseNotesURL");
    if (relNotesURL != "about:blank") {
      relNotesLink.href = relNotesURL;
      relNotesLink.hidden = false;
    }
  }

  if (AppConstants.MOZ_UPDATER) {
    gAppUpdater = new appUpdater({ buttonAutoFocus: true });

    let channelLabel = document.getElementById("currentChannel");
    let currentChannelText = document.getElementById("currentChannelText");
    channelLabel.value = UpdateUtils.UpdateChannel;
    if (/^release($|\-)/.test(channelLabel.value))
        currentChannelText.hidden = true;
  }

  if (AppConstants.MOZ_APP_VERSION_DISPLAY.endsWith("esr")) {
    document.getElementById("release").hidden = false;
  }
  if (AppConstants.platform == "macosx") {
    // it may not be sized at this point, and we need its width to calculate its position
    window.sizeToContent();
    window.moveTo((screen.availWidth / 2) - (window.outerWidth / 2), screen.availHeight / 5);
  }
}
