"use strict";

var EXPORTED_SYMBOLS = ["TorLogDialog"];

const { TorProtocolService } = ChromeUtils.import(
  "resource:///modules/TorProtocolService.jsm"
);
const { TorStrings } = ChromeUtils.import("resource:///modules/TorStrings.jsm");

class TorLogDialog {
  constructor() {
    this._dialog = null;
    this._logTextarea = null;
    this._copyLogButton = null;
  }

  static get selectors() {
    return {
      copyLogButton: "extra1",
      logTextarea: "textarea#torPreferences-torDialog-textarea",
    };
  }

  _populateXUL(aDialog) {
    this._dialog = aDialog;
    this._dialog.setAttribute("title", TorStrings.settings.torLogDialogTitle);

    this._logTextarea = this._dialog.querySelector(
      TorLogDialog.selectors.logTextarea
    );

    this._copyLogButton = this._dialog.getButton(
      TorLogDialog.selectors.copyLogButton
    );
    this._copyLogButton.setAttribute("label", TorStrings.settings.copyLog);
    this._copyLogButton.addEventListener("command", () => {
      this.copyTorLog();
    });

    this._logTextarea.value = TorProtocolService.getLog();
  }

  init(window, aDialog) {
    // defer to later until firefox has populated the dialog with all our elements
    window.setTimeout(() => {
      this._populateXUL(aDialog);
    }, 0);
  }

  copyTorLog() {
    // Copy tor log messages to the system clipboard.
    let clipboard = Cc["@mozilla.org/widget/clipboardhelper;1"].getService(
      Ci.nsIClipboardHelper
    );
    clipboard.copyString(this._logTextarea.value);
  }

  openDialog(gSubDialog) {
    gSubDialog.open(
      "chrome://browser/content/torpreferences/torLogDialog.xul",
      "resizable=yes",
      this
    );
  }
}
