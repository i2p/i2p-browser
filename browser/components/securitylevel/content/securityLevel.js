"use strict";

ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyModuleGetters(this, {
  CustomizableUI: "resource:///modules/CustomizableUI.jsm",
  PanelMultiView: "resource:///modules/PanelMultiView.jsm",
});

ChromeUtils.defineModuleGetter(
  this,
  "TorStrings",
  "resource:///modules/TorStrings.jsm"
);

/*
  Security Level Prefs

  Getters and Setters for relevant torbutton prefs
*/
const SecurityLevelPrefs = {
  security_slider_pref : "extensions.torbutton.security_slider",
  security_custom_pref : "extensions.torbutton.security_custom",

  get securitySlider() {
    try {
      return Services.prefs.getIntPref(this.security_slider_pref);
    } catch(e) {
      // init pref to 4 (standard)
      const val = 4;
      Services.prefs.setIntPref(this.security_slider_pref, val);
      return val;
    }
  },

  set securitySlider(val) {
    Services.prefs.setIntPref(this.security_slider_pref, val);
  },

  get securityCustom() {
    try {
      return Services.prefs.getBoolPref(this.security_custom_pref);
    } catch(e) {
      // init custom to false
      const val = false;
      Services.prefs.setBoolPref(this.security_custom_pref, val);
      return val;
    }
  },

  set securityCustom(val) {
    Services.prefs.setBoolPref(this.security_custom_pref, val);
  },
}; /* Security Level Prefs */

/*
  Security Level Button Code

  Controls init and update of the security level toolbar button
*/

const SecurityLevelButton = {
  _securityPrefsBranch : null,

  _populateXUL : function(securityLevelButton) {
    if (securityLevelButton != null) {
      securityLevelButton.setAttribute("tooltiptext", TorStrings.securityLevel.securityLevel);
      securityLevelButton.setAttribute("label", TorStrings.securityLevel.securityLevel);
    }
  },

  _configUIFromPrefs : function(securityLevelButton) {
    if (securityLevelButton != null) {
      let securitySlider = SecurityLevelPrefs.securitySlider;
      let classList = securityLevelButton.classList;
      classList.remove("standard", "safer", "safest");
      switch(securitySlider) {
        case 4:
          classList.add("standard");
          securityLevelButton.setAttribute("tooltiptext", TorStrings.securityLevel.standard.tooltip);
          break;
        case 2:
          classList.add("safer");
          securityLevelButton.setAttribute("tooltiptext", TorStrings.securityLevel.safer.tooltip);
          break;
        case 1:
          classList.add("safest");
          securityLevelButton.setAttribute("tooltiptext", TorStrings.securityLevel.safest.tooltip);
          break;
      }
    }
  },

  get button() {
    let button = document.getElementById("security-level-button");
    if (!button) {
      return null;
    }
    return button;
  },

  get anchor() {
    let anchor = document.getAnonymousElementByAttribute(this.button, "class",
                                                   "toolbarbutton-icon");
    if (!anchor) {
      return null;
    }

    anchor.setAttribute("consumeanchor", SecurityLevelButton.button.id);
    return anchor;
  },

  init : function() {
    // set the initial class based off of the current pref
    let button = this.button;
    this._populateXUL(button);
    this._configUIFromPrefs(button);

    this._securityPrefsBranch = Services.prefs.getBranch("extensions.torbutton.");
    this._securityPrefsBranch.addObserver("", this, false);

    CustomizableUI.addListener(this);

    SecurityLevelPanel.init();
  },

  uninit : function() {
    CustomizableUI.removeListener(this);

    this._securityPrefsBranch.removeObserver("", this);
    this._securityPrefsBranch = null;

    SecurityLevelPanel.uninit();
  },

  observe : function(subject, topic, data) {
    switch(topic) {
      case "nsPref:changed":
        if (data == "security_slider") {
          this._configUIFromPrefs(this.button);
        }
        break;
    }
  },

  // callback for entering the 'Customize Firefox' screen to set icon
  onCustomizeStart : function(window) {
    let navigatorToolbox = document.getElementById("navigator-toolbox");
    let button = navigatorToolbox.palette.querySelector("#security-level-button");
    this._populateXUL(button);
    this._configUIFromPrefs(button);
  },

  // callback when CustomizableUI modifies DOM
  onWidgetAfterDOMChange : function(aNode, aNextNode, aContainer, aWasRemoval) {
    if (aNode.id == "security-level-button" && !aWasRemoval) {
      this._populateXUL(aNode);
      this._configUIFromPrefs(aNode);
    }
  },

  // for when the toolbar button needs to be activated and displays the Security Level panel
  //
  // In the toolbarbutton xul you'll notice we register this callback for both onkeypress and
  // onmousedown. We do this to match the behavior of other panel spawning buttons such as Downloads,
  // Library, and the Hamburger menus. Using oncommand alone would result in only getting fired
  // after onclick, which is mousedown followed by mouseup.
  onCommand : function(aEvent) {
    // snippet stolen from /browser/components/downloads/indicator.js DownloadsIndicatorView.onCommand(evt)
    if (
      (aEvent.type == "mousedown" && aEvent.button != 0) ||
      (aEvent.type == "keypress" && aEvent.key != " " && aEvent.key != "Enter")
    ) {
      return;
    }

    // we need to set this attribute for the button to be shaded correctly to look like it is pressed
    // while the security level panel is open
    this.button.setAttribute("open", "true");
    SecurityLevelPanel.show();
  },
}; /* Security Level Button */

/*
  Security Level Panel Code

  Controls init and update of the panel in the security level hanger
*/

const SecurityLevelPanel = {
  _securityPrefsBranch : null,
  _panel : null,
  _anchor : null,
  _populated : false,

  _populateXUL : function() {
    // get the panel elements we need to populate
    let panelview = document.getElementById("securityLevel-panelview");
    let labelHeader = panelview.querySelector("#securityLevel-header");
    let labelCustomWarning = panelview.querySelector("#securityLevel-customWarning")
    let labelLearnMore = panelview.querySelector("#securityLevel-learnMore");
    let buttonRestoreDefaults = panelview.querySelector("#securityLevel-restoreDefaults");
    let buttonAdvancedSecuritySettings = panelview.querySelector("#securityLevel-advancedSecuritySettings");

    labelHeader.setAttribute("value", TorStrings.securityLevel.securityLevel);
    labelCustomWarning.setAttribute("value", TorStrings.securityLevel.customWarning);
    labelLearnMore.setAttribute("value", TorStrings.securityLevel.learnMore);
    labelLearnMore.setAttribute("href", TorStrings.securityLevel.learnMoreURL);
    buttonRestoreDefaults.setAttribute("label", TorStrings.securityLevel.restoreDefaults);
    buttonAdvancedSecuritySettings.setAttribute("label", TorStrings.securityLevel.advancedSecuritySettings);

    // rest of the XUL is set based on security prefs
    this._configUIFromPrefs();

    this._populated = true;
  },

  _configUIFromPrefs : function() {
    // get security prefs
    let securitySlider = SecurityLevelPrefs.securitySlider;
    let securityCustom = SecurityLevelPrefs.securityCustom;

    // get the panel elements we need to populate
    let panelview = document.getElementById("securityLevel-panelview");
    let labelLevel = panelview.querySelector("#securityLevel-level");
    let labelCustomWarning = panelview.querySelector("#securityLevel-customWarning")
    let summary = panelview.querySelector("#securityLevel-summary");
    let buttonRestoreDefaults = panelview.querySelector("#securityLevel-restoreDefaults");
    let buttonAdvancedSecuritySettings = panelview.querySelector("#securityLevel-advancedSecuritySettings");

    // only visible when user is using custom settings
    labelCustomWarning.hidden = !securityCustom;
    buttonRestoreDefaults.hidden = !securityCustom;

    // Descriptions change based on security level
    switch(securitySlider) {
      // standard
      case 4:
        labelLevel.setAttribute("value", TorStrings.securityLevel.standard.level);
        summary.textContent = TorStrings.securityLevel.standard.summary;
        break;
      // safer
      case 2:
        labelLevel.setAttribute("value", TorStrings.securityLevel.safer.level);
        summary.textContent = TorStrings.securityLevel.safer.summary;
        break;
      // safest
      case 1:
        labelLevel.setAttribute("value", TorStrings.securityLevel.safest.level);
        summary.textContent = TorStrings.securityLevel.safest.summary;
        break;
    }

    // override the summary text with custom warning
    if (securityCustom) {
      summary.textContent = TorStrings.securityLevel.custom.summary;
    }
  },

  init : function() {
    this._securityPrefsBranch = Services.prefs.getBranch("extensions.torbutton.");
    this._securityPrefsBranch.addObserver("", this, false);
  },

  uninit : function() {
    this._securityPrefsBranch.removeObserver("", this);
    this._securityPrefsBranch = null;
  },

  show : function() {
    // we have to defer this until after the browser has finished init'ing before
    // we can populate the panel
    if (!this._populated) {
      this._populateXUL();
    }

    let panel = document.getElementById("securityLevel-panel");
    panel.hidden = false;
    PanelMultiView.openPopup(panel, SecurityLevelButton.anchor, "bottomcenter topright",
                             0, 0, false, null).catch(Cu.reportError);
  },

  hide : function() {
    let panel = document.getElementById("securityLevel-panel");
    PanelMultiView.hidePopup(panel);
  },

  restoreDefaults : function() {
    SecurityLevelPrefs.securityCustom = false;
    // hide and reshow so that layout re-renders properly
    this.hide();
    this.show(this._anchor);
  },

  openAdvancedSecuritySettings : function() {
    openPreferences("privacy-securitylevel");
    this.hide();
  },

  // callback when prefs change
  observe : function(subject, topic, data) {
    switch(topic) {
      case "nsPref:changed":
        if (data == "security_slider" || data == "security_custom") {
          this._configUIFromPrefs();
        }
        break;
    }
  },

  // callback when the panel is displayed
  onPopupShown : function(event) {
    SecurityLevelButton.button.setAttribute("open", "true");
  },

  // callback when the panel is hidden
  onPopupHidden : function(event) {
    SecurityLevelButton.button.removeAttribute("open");
  }
}; /* Security Level Panel */

/*
  Security Level Preferences Code

  Code to handle init and update of security level section in about:preferences#privacy
*/

const SecurityLevelPreferences =
{
  _securityPrefsBranch : null,

  _populateXUL : function() {
    let groupbox = document.getElementById("securityLevel-groupbox");

    let labelHeader = groupbox.querySelector("#securityLevel-header");
    labelHeader.textContent = TorStrings.securityLevel.securityLevel;

    let spanOverview = groupbox.querySelector("#securityLevel-overview");
    spanOverview.textContent = TorStrings.securityLevel.overview;

    let labelLearnMore = groupbox.querySelector("#securityLevel-learnMore");
    labelLearnMore.setAttribute("value", TorStrings.securityLevel.learnMore);
    labelLearnMore.setAttribute("href", TorStrings.securityLevel.learnMoreURL);

    let populateRadioElements = function(vboxQuery, stringStruct) {
      let vbox = groupbox.querySelector(vboxQuery);

      let radio = vbox.querySelector("radio");
      radio.setAttribute("label", stringStruct.level);

      let customWarning = vbox.querySelector("#securityLevel-customWarning");
      customWarning.setAttribute("value", TorStrings.securityLevel.customWarning);

      let labelSummary = vbox.querySelector("#securityLevel-summary");
      labelSummary.textContent = stringStruct.summary;

      let labelRestoreDefaults = vbox.querySelector("#securityLevel-restoreDefaults");
      labelRestoreDefaults.setAttribute("value", TorStrings.securityLevel.restoreDefaults);

      let description1 = vbox.querySelector("#securityLevel-description1");
      if (description1) {
        description1.textContent = stringStruct.description1;
      }
      let description2 = vbox.querySelector("#securityLevel-description2");
      if (description2) {
        description2.textContent = stringStruct.description2;
      }
      let description3 = vbox.querySelector("#securityLevel-description3");
      if (description3) {
        description3.textContent = stringStruct.description3;
      }
    };

    populateRadioElements("#securityLevel-vbox-standard", TorStrings.securityLevel.standard);
    populateRadioElements("#securityLevel-vbox-safer", TorStrings.securityLevel.safer);
    populateRadioElements("#securityLevel-vbox-safest", TorStrings.securityLevel.safest);
  },

  _configUIFromPrefs : function() {
    // read our prefs
    let securitySlider = SecurityLevelPrefs.securitySlider;
    let securityCustom = SecurityLevelPrefs.securityCustom;

    // get our elements
    let groupbox = document.getElementById("securityLevel-groupbox");

    let radiogroup =  groupbox.querySelector("#securityLevel-radiogroup");
    let labelStandardCustom = groupbox.querySelector("#securityLevel-vbox-standard label#securityLevel-customWarning");
    let labelSaferCustom = groupbox.querySelector("#securityLevel-vbox-safer label#securityLevel-customWarning");
    let labelSafestCustom = groupbox.querySelector("#securityLevel-vbox-safest label#securityLevel-customWarning");
    let labelStandardRestoreDefaults = groupbox.querySelector("#securityLevel-vbox-standard label#securityLevel-restoreDefaults");
    let labelSaferRestoreDefaults = groupbox.querySelector("#securityLevel-vbox-safer label#securityLevel-restoreDefaults");
    let labelSafestRestoreDefaults = groupbox.querySelector("#securityLevel-vbox-safest label#securityLevel-restoreDefaults");

    // hide custom label by default until we know which level we're at
    labelStandardCustom.hidden = true;
    labelSaferCustom.hidden = true;
    labelSafestCustom.hidden = true;

    labelStandardRestoreDefaults.hidden = true;
    labelSaferRestoreDefaults.hidden = true;
    labelSafestRestoreDefaults.hidden = true;

    switch(securitySlider) {
      // standard
      case 4:
        radiogroup.value = "standard";
        labelStandardCustom.hidden = !securityCustom;
        labelStandardRestoreDefaults.hidden = !securityCustom;
        break;
      // safer
      case 2:
        radiogroup.value = "safer";
        labelSaferCustom.hidden = !securityCustom;
        labelSaferRestoreDefaults.hidden = !securityCustom;
        break;
      // safest
      case 1:
        radiogroup.value = "safest";
        labelSafestCustom.hidden = !securityCustom;
        labelSafestRestoreDefaults.hidden = !securityCustom;
        break;
    }
  },

  init : function() {
    // populate XUL with localized strings
    this._populateXUL();

    // read prefs and populate UI
    this._configUIFromPrefs();

    // register for pref chagnes
    this._securityPrefsBranch = Services.prefs.getBranch("extensions.torbutton.");
    this._securityPrefsBranch.addObserver("", this, false);
  },

  uninit : function() {
    // unregister for pref change events
    this._securityPrefsBranch.removeObserver("", this);
    this._securityPrefsBranch = null;
  },

  // callback for when prefs change
  observe : function(subject, topic, data) {
    switch(topic) {
      case "nsPref:changed":
        if (data == "security_slider" ||
            data == "security_custom") {
          this._configUIFromPrefs();
        }
        break;
    }
  },

  selectSecurityLevel : function() {
    // radio group elements
    let radiogroup =  document.getElementById("securityLevel-radiogroup");

    // update pref based on selected radio option
    switch (radiogroup.value) {
      case "standard":
        SecurityLevelPrefs.securitySlider = 4;
        break;
      case "safer":
        SecurityLevelPrefs.securitySlider = 2;
        break;
      case "safest":
        SecurityLevelPrefs.securitySlider = 1;
        break;
    }

    this.restoreDefaults();
  },

  restoreDefaults : function() {
    SecurityLevelPrefs.securityCustom = false;
  },
}; /* Security Level Prefereces */

Object.defineProperty(this, "SecurityLevelButton", {
  value: SecurityLevelButton,
  enumerable: true,
  writable: false
});

Object.defineProperty(this, "SecurityLevelPanel", {
  value: SecurityLevelPanel,
  enumerable: true,
  writable: false
});

Object.defineProperty(this, "SecurityLevelPreferences", {
  value: SecurityLevelPreferences,
  enumerable: true,
  writable: false
});
