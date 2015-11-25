// Copyright (c) 2019, The Tor Project, Inc.
// See LICENSE for licensing information.
//
// vim: set sw=2 sts=2 ts=8 et syntax=javascript:

"use strict";

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

this.EXPORTED_SYMBOLS = [ "AboutTBUpdate" ];

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");

const kRequestUpdateMessageName = "AboutTBUpdate:RequestUpdate";
const kSendUpdateMessageName    = "AboutTBUpdate:Update";

#expand const TOR_BROWSER_VERSION = __TOR_BROWSER_VERSION_QUOTED__;

/**
 * This code provides services to the about:tbupdate page. Whenever
 * about:tbupdate needs to do something chrome-privileged, it sends a
 * message that's handled here. It is modeled after Mozilla's about:home
 * implementation.
 */
var AboutTBUpdate = {
  init: function() {
    Services.mm.addMessageListener(kRequestUpdateMessageName, this);
  },

  receiveMessage: function(aMessage) {
    if (aMessage.name == kRequestUpdateMessageName)
      this.sendAboutTBUpdateData(aMessage.target);
  },

  sendAboutTBUpdateData: function(aTarget) {
    let data = this.releaseNoteInfo;
    data.moreInfoURL = this.moreInfoURL;
    if (aTarget && aTarget.messageManager) {
      aTarget.messageManager.sendAsyncMessage(kSendUpdateMessageName, data);
    } else {
      Services.mm.broadcastAsyncMessage(kSendUpdateMessageName, data);
    }
  },

  get moreInfoURL() {
    try {
      return Services.prefs.getCharPref("torbrowser.post_update.url");
    } catch (e) {}

    // Use the default URL as a fallback.
    return Services.urlFormatter.formatURLPref("startup.homepage_override_url");
  },

  // Read the text from the beginning of the changelog file that is located
  // at TorBrowser/Docs/ChangeLog.txt and return an object that contains
  // the following properties:
  //   version        e.g., Tor Browser 8.5
  //   releaseDate    e.g., March 31 2019
  //   releaseNotes   details of changes (lines 2 - end of ChangeLog.txt)
  // We attempt to parse the first line of ChangeLog.txt to extract the
  // version and releaseDate. If parsing fails, we return the entire first
  // line in version and omit releaseDate.
  //
  // On Mac OS, when building with --enable-tor-browser-data-outside-app-dir
  // to support Gatekeeper signing, the ChangeLog.txt file is located in
  // TorBrowser.app/Contents/Resources/TorBrowser/Docs/.
  get releaseNoteInfo() {
    let info = {};

    try {
#ifdef TOR_BROWSER_DATA_OUTSIDE_APP_DIR
      // "XREExeF".parent is the directory that contains firefox, i.e.,
      // Browser/ or, on Mac OS, TorBrowser.app/Contents/MacOS/.
      let f = Services.dirsvc.get("XREExeF", Ci.nsIFile).parent;
#ifdef XP_MACOSX
      f = f.parent;
      f.append("Resources");
#endif
      f.append("TorBrowser");
#else
      // "DefProfRt" is .../TorBrowser/Data/Browser
      let f = Cc["@mozilla.org/file/directory_service;1"]
                .getService(Ci.nsIProperties).get("DefProfRt", Ci.nsIFile);
      f = f.parent.parent;  // Remove "Data/Browser"
#endif
      f.append("Docs");
      f.append("ChangeLog.txt");

      let fs = Cc["@mozilla.org/network/file-input-stream;1"]
                 .createInstance(Ci.nsIFileInputStream);
      fs.init(f, -1, 0, 0);
      let s = NetUtil.readInputStreamToString(fs, fs.available());
      fs.close();

      // Truncate at the first empty line.
      s = s.replace(/[\r\n][\r\n][\s\S]*$/m, "");

      // Split into first line (version plus releaseDate) and
      // remainder (releaseNotes).
      // This first match() uses multiline mode with two capture groups:
      //   first line: (.*$)
      //   remaining lines: ([\s\S]+)
      //     [\s\S] matches all characters including end of line. This trick
      //     is needed because when using JavaScript regex in multiline mode,
      //     . does not match an end of line character.
      let matchArray = s.match(/(.*$)\s*([\s\S]+)/m);
      if (matchArray && (matchArray.length == 3)) {
        info.releaseNotes = matchArray[2];
        let line1 = matchArray[1];
        // Extract the version and releaseDate. The first line looks like:
        //   Tor Browser 8.5 -- May 1 2019
        // The regex uses two capture groups:
        //   text that does not include a hyphen: (^[^-]*)
        //   remaining text: (.*$)
        // In between we match optional whitespace, one or more hyphens, and
        // optional whitespace by using: \s*-+\s*
        matchArray = line1.match(/(^[^-]*)\s*-+\s*(.*$)/);
        if (matchArray && (matchArray.length == 3)) {
          info.version = matchArray[1];
          info.releaseDate = matchArray[2];
        } else {
          info.version = line1; // Match failed: return entire line in version.
        }
      } else {
        info.releaseNotes = s; // Only one line: use as releaseNotes.
      }
    } catch (e) {}

    return info;
  },
};
