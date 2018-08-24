// Copyright (c) 2018, The Tor Project, Inc.
// vim: set sw=2 sts=2 ts=8 et syntax=javascript:

let gStringBundle;

let domLoadedListener = (aEvent) => {
  let doc = aEvent.originalTarget;
  if (doc.nodeName == "#document") {
    removeEventListener("DOMContentLoaded", domLoadedListener);
    beginCircuitDisplayOnboarding();
  }
};

addEventListener("DOMContentLoaded", domLoadedListener, false);

function beginCircuitDisplayOnboarding() {
  // 1 of 3: Show the introductory "How do circuits work?" info panel.
  let target = "torBrowser-circuitDisplay";
  let title = getStringFromName("intro.title");
  let msg = getStringFromName("intro.msg");
  let button1Label = getStringFromName("one-of-three");
  let button2Label = getStringFromName("next");
  let buttons = [];
  buttons.push({label: button1Label, style: "text"});
  buttons.push({label: button2Label, style: "primary", callback: function() {
    showCircuitDiagram(); }});
  let options = {closeButtonCallback: function() { cleanUp(); }};
  Mozilla.UITour.showInfo(target, title, msg, undefined, buttons, options);
}

function showCircuitDiagram() {
  // 2 of 3: Open the control center and show the circuit diagram info panel.
  Mozilla.UITour.showMenu("controlCenter", function() {
    let target = "torBrowser-circuitDisplay-diagram";
    let title = getStringFromName("diagram.title");
    let msg = getStringFromName("diagram.msg");
    let button1Label = getStringFromName("two-of-three");
    let button2Label = getStringFromName("next");
    let buttons = [];
    buttons.push({label: button1Label, style: "text"});
    buttons.push({label: button2Label, style: "primary", callback: function() {
      showNewCircuitButton(); }});
    let options = {closeButtonCallback: function() { cleanUp(); }};
    Mozilla.UITour.showInfo(target, title, msg, undefined, buttons, options);
  });
}

function showNewCircuitButton() {
  // 3 of 3: Show the New Circuit button info panel.
  let target = "torBrowser-circuitDisplay-newCircuitButton";
  let title = getStringFromName("new-circuit.title");
  let msg = getStringFromName("new-circuit.msg");
  let button1Label = getStringFromName("three-of-three");
  let button2Label = getStringFromName("done");
  let buttons = [];
  buttons.push({label: button1Label, style: "text"});
  buttons.push({label: button2Label, style: "primary", callback: function() {
    cleanUp(); }});
  let options = {closeButtonCallback: function() { cleanUp(); }};
  Mozilla.UITour.showInfo(target, title, msg, undefined, buttons, options);
}

function cleanUp() {
  Mozilla.UITour.hideMenu("controlCenter");
  Mozilla.UITour.closeTab();
}

function getStringFromName(aName) {
  const TORBUTTON_BUNDLE_URI = "chrome://torbutton/locale/browserOnboarding.properties";
  const PREFIX = "onboarding.tor-circuit-display.";

  if (!gStringBundle) {
    gStringBundle = Services.strings.createBundle(TORBUTTON_BUNDLE_URI)
  }

  let result;
  try {
    result = gStringBundle.GetStringFromName(PREFIX + aName);
  } catch (e) {
    result = aName;
  }
  return result;
}


// The remainder of the code in this file was adapted from
// browser/components/uitour/UITour-lib.js (unfortunately, we cannot use that
// code here because it directly accesses 'document' and it assumes that the
// content window is the global JavaScript object),

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// create namespace
if (typeof Mozilla == "undefined") {
  var Mozilla = {};
}

(function($) {
  "use strict";

  // create namespace
  if (typeof Mozilla.UITour == "undefined") {
    /**
     * Library that exposes an event-based Web API for communicating with the
     * desktop browser chrome. It can be used for tasks such as opening menu
     * panels and highlighting the position of buttons in the toolbar.
     *
     * <p>For security/privacy reasons `Mozilla.UITour` will only work on a list of allowed
     * secure origins. The list of allowed origins can be found in
     * {@link https://dxr.mozilla.org/mozilla-central/source/browser/app/permissions|
     * browser/app/permissions}.</p>
     *
     * @since 29
     * @namespace
     */
    Mozilla.UITour = {};
  }

  function _sendEvent(action, data) {
    var event = new content.CustomEvent("mozUITour", {
      bubbles: true,
      detail: {
        action,
        data: data || {}
      }
    });

    content.document.dispatchEvent(event);
  }

  function _generateCallbackID() {
    return Math.random().toString(36).replace(/[^a-z]+/g, "");
  }

  function _waitForCallback(callback) {
    var id = _generateCallbackID();

    function listener(event) {
      if (typeof event.detail != "object")
        return;
      if (event.detail.callbackID != id)
        return;

      content.document.removeEventListener("mozUITourResponse", listener);
      callback(event.detail.data);
    }
    content.document.addEventListener("mozUITourResponse", listener);

    return id;
  }

  /**
   * Show an arrow panel with optional images and buttons anchored at a specific UI target.
   *
   * @see Mozilla.UITour.hideInfo
   *
   * @param {Mozilla.UITour.Target} target - Identifier of the UI widget to anchor the panel at.
   * @param {String} title - Title text to be shown as the heading of the panel.
   * @param {String} text - Body text of the panel.
   * @param {String} [icon=null] - URL of a 48x48px (96px @ 2dppx) image (which will be resolved
   *                               relative to the tab's URI) to display in the panel.
   * @param {Object[]} [buttons=[]] - Array of objects describing buttons.
   * @param {String} buttons[].label - Button label
   * @param {String} buttons[].icon - Button icon URL
   * @param {String} buttons[].style - Button style ("primary" or "link")
   * @param {Function} buttons[].callback - Called when the button is clicked
   * @param {Object} [options={}] - Advanced options
   * @param {Function} options.closeButtonCallback - Called when the panel's close button is clicked.
   *
   * @example
   * var buttons = [
   *   {
   *     label: 'Cancel',
   *     style: 'link',
   *     callback: cancelBtnCallback
   *   },
   *   {
   *     label: 'Confirm',
   *     style: 'primary',
   *     callback: confirmBtnCallback
   *   }
   * ];
   *
   * var icon = '//mozorg.cdn.mozilla.net/media/img/firefox/australis/logo.png';
   *
   * var options = {
   *   closeButtonCallback: closeBtnCallback
   * };
   *
   * Mozilla.UITour.showInfo('appMenu', 'my title', 'my text', icon, buttons, options);
   */
  Mozilla.UITour.showInfo = function(target, title, text, icon, buttons, options) {
    var buttonData = [];
    if (Array.isArray(buttons)) {
      for (var i = 0; i < buttons.length; i++) {
        buttonData.push({
          label: buttons[i].label,
          icon: buttons[i].icon,
          style: buttons[i].style,
          callbackID: _waitForCallback(buttons[i].callback)
        });
      }
    }

    var closeButtonCallbackID, targetCallbackID;
    if (options && options.closeButtonCallback)
      closeButtonCallbackID = _waitForCallback(options.closeButtonCallback);
    if (options && options.targetCallback)
      targetCallbackID = _waitForCallback(options.targetCallback);

    _sendEvent("showInfo", {
      target,
      title,
      text,
      icon,
      buttons: buttonData,
      closeButtonCallbackID,
      targetCallbackID
    });
  };

  /**
   * Hide any visible info panels.
   * @see Mozilla.UITour.showInfo
   */
  Mozilla.UITour.hideInfo = function() {
    _sendEvent("hideInfo");
  };

  /**
   * Open the named application menu.
   *
   * @see Mozilla.UITour.hideMenu
   *
   * @param {Mozilla.UITour.MenuName} name - Menu name
   * @param {Function} [callback] - Callback to be called with no arguments when
   *                                the menu opens.
   *
   * @example
   * Mozilla.UITour.showMenu('appMenu', function() {
   *   console.log('menu was opened');
   * });
   */
  Mozilla.UITour.showMenu = function(name, callback) {
    var showCallbackID;
    if (callback)
      showCallbackID = _waitForCallback(callback);

    _sendEvent("showMenu", {
      name,
      showCallbackID,
    });
  };

  /**
   * Close the named application menu.
   *
   * @see Mozilla.UITour.showMenu
   *
   * @param {Mozilla.UITour.MenuName} name - Menu name
   */
  Mozilla.UITour.hideMenu = function(name) {
    _sendEvent("hideMenu", {
      name
    });
  };

  /**
   * @summary Closes the tab where this code is running. As usual, if the tab is in the
   * foreground, the tab that was displayed before is selected.
   *
   * @description The last tab in the current window will never be closed, in which case
   * this call will have no effect. The calling code is expected to take an
   * action after a small timeout in order to handle this case, for example by
   * displaying a goodbye message or a button to restart the tour.
   * @since 46
   */
  Mozilla.UITour.closeTab = function() {
    _sendEvent("closeTab");
  };
})();
