"use strict";

ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyModuleGetters(this, {
  CustomizableUI: "resource:///modules/CustomizableUI.jsm",
  PanelMultiView: "resource:///modules/PanelMultiView.jsm",
});

/*
 Security Level Strings

 Strings loaded from torbutton, but en-US defaults provided in case torbutton addon not enabled
*/
XPCOMUtils.defineLazyGetter(this, "SecurityLevelStrings", function() {
  let sls = null;
  try {
    sls = Services.strings.createBundle("chrome://torbutton/locale/securityLevel.properties");
  } catch(e) { }

  // tries to get the given key from the string bundle, return fallback on failure
  let getString = function(key, fallback) {
    let retval = "";
    if (sls) {
      try {
        retval = sls.GetStringFromName(key);
      } catch(e) { }
    }
    if (retval == "") {
      retval = fallback;
    }
    return retval;
  };

  // read localized strings from torbutton; but use hard-coded en-US strings as fallbacks in case of error
  let retval = {
    securityLevel : getString("securityLevel.securityLevel", "Security Level"),
    customWarning : getString("securityLevel.customWarning", "Custom"),
    overview : getString("securityLevel.overview", "Disable certain web features that can be used to attack your security and anonymity."),
    standard : {
      level : getString("securityLevel.standard.level", "Standard"),
      tooltip : getString("securityLevel.standard.tooltip", "Security Level : Standard"),
      summary : getString("securityLevel.standard.summary", "All Tor Browser and website features are enabled."),
    },
    safer : {
      level : getString("securityLevel.safer.level", "Safer"),
      tooltip : getString("securityLevel.safer.tooltip", "Security Level : Safer"),
      summary : getString("securityLevel.safer.summary", "Disables website features that are often dangerous, causing some sites to lose functionality."),
      description1 : getString("securityLevel.safer.description1", "JavaScript is disabled on non-HTTPS sites."),
      description2 : getString("securityLevel.safer.description2", "Some fonts and math symbols are disabled."),
      description3 : getString("securityLevel.safer.description3", "Audio and video (HTML5 media) are click-to-play."),
    },
    safest : {
      level : getString("securityLevel.safest.level", "Safest"),
      tooltip : getString("securityLevel.safest.tooltip", "Security Level : Safest"),
      summary : getString("securityLevel.safest.summary", "Only allows website features required for static sites and basic services. These changes affect images, media, and scripts."),
      description1 : getString("securityLevel.safest.description1", "JavaScript is disabled by default on all sites."),
      description2 : getString("securityLevel.safest.description2", "Some fonts, icons, math symbols, and images are disabled."),
      description3 : getString("securityLevel.safest.description3", "Audio and video (HTML5 media) are click-to-play."),
    },
    custom : {
      summary : getString("securityLevel.custom.summary", "Your custom browser preferences have resulted in unusual security settings. For security and privacy reasons, we recommend you choose one of the default security levels."),
    },
    learnMore : getString("securityLevel.learnMore", "Learn more"),
    learnMoreURL : function() {
        let locale = "";
        try {
          let { getLocale } =
            Cu.import("resource://torbutton/modules/utils.js", {});
          locale = getLocale();
        } catch(e) {}

        if (locale == "") {
          locale = "en-US";
        }

        return "https://tb-manual.torproject.org/" + locale + "/security-settings.html";
      }(),
    restoreDefaults : getString("securityLevel.restoreDefaults", "Restore Defaults"),
    advancedSecuritySettings : getString("securityLevel.advancedSecuritySettings", "Advanced Security Settings\u2026"),
  };


  return retval;
});


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
};

/*
  Security Level Button Code

  Controls init and update of the security level toolbar button
*/

const SecurityLevelButton = {
  _securityPrefsBranch : null,

  _populateXUL : function(securityLevelButton) {
    if (securityLevelButton != null) {
      securityLevelButton.setAttribute("tooltiptext", SecurityLevelStrings.securityLevel);
      securityLevelButton.setAttribute("label", SecurityLevelStrings.securityLevel);
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
          securityLevelButton.setAttribute("tooltiptext", SecurityLevelStrings.standard.tooltip);
          break;
        case 2:
          classList.add("safer");
          securityLevelButton.setAttribute("tooltiptext", SecurityLevelStrings.safer.tooltip);
          break;
        case 1:
          classList.add("safest");
          securityLevelButton.setAttribute("tooltiptext", SecurityLevelStrings.safest.tooltip);
          break;
      }
    }
  },

  init : function() {
    // set the initial class based off of the current pref
    let button = document.getElementById("security-level-button");
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
          this._configUIFromPrefs(document.getElementById("security-level-button"));
        }
        break;
    }
  },

  // callbacks for entering the 'Customize Firefox' screen to set icon
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

  // when toolbar button is pressed
  onCommand : function(anchor, event) {
    SecurityLevelPanel.show(anchor);
  },
};

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

    labelHeader.setAttribute("value", SecurityLevelStrings.securityLevel);
    labelCustomWarning.setAttribute("value", SecurityLevelStrings.customWarning);
    labelLearnMore.setAttribute("value", SecurityLevelStrings.learnMore);
    labelLearnMore.setAttribute("href", SecurityLevelStrings.learnMoreURL);
    buttonRestoreDefaults.setAttribute("label", SecurityLevelStrings.restoreDefaults);
    buttonAdvancedSecuritySettings.setAttribute("label", SecurityLevelStrings.advancedSecuritySettings);

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
        labelLevel.setAttribute("value", SecurityLevelStrings.standard.level);
        summary.textContent = SecurityLevelStrings.standard.summary;
        break;
      // safer
      case 2:
        labelLevel.setAttribute("value", SecurityLevelStrings.safer.level);
        summary.textContent = SecurityLevelStrings.safer.summary;
        break;
      // safest
      case 1:
        labelLevel.setAttribute("value", SecurityLevelStrings.safest.level);
        summary.textContent = SecurityLevelStrings.safest.summary;
        break;
    }

    // override the summary text with custom warning
    if (securityCustom) {
      summary.textContent = SecurityLevelStrings.custom.summary;
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

  show : function(anchor) {
    // we have to defer this until after the browser has finished init'ing before
    // we can populate the panel
    if (!this._populated) {
      this._populateXUL();
    }

    // save off anchor in case we want to show from our own code
    this._anchor = anchor;

    let panel = document.getElementById("securityLevel-panel");
    panel.hidden = false;
    PanelMultiView.openPopup(panel, anchor, "bottomcenter topright",
                             0, 0, false, null).catch(Cu.reportError);
  },

  hide : function() {
    let panel = document.getElementById("securityLevel-panel");
    PanelMultiView.hidePopup(panel);
  },

  // when prefs change
  observe : function(subject, topic, data) {
    switch(topic) {
      case "nsPref:changed":
        if (data == "security_slider" || data == "security_custom") {
          this._configUIFromPrefs();
        }
        break;
    }
  },

  restoreDefaults : function() {
    SecurityLevelPrefs.securityCustom = false;
    // hide and reshow so that layout re-renders properly
    this.hide();
    this.show(this._anchor);
  },

  openAdvancedSecuritySettings : async function() {
    openPreferences("privacy-securitylevel");
    this.hide();
  }
};

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
    labelHeader.setAttribute("value", SecurityLevelStrings.securityLevel);

    let spanOverview = groupbox.querySelector("#securityLevel-overview");
    spanOverview.textContent = SecurityLevelStrings.overview;

    let labelLearnMore = groupbox.querySelector("#securityLevel-learnMore");
    labelLearnMore.setAttribute("value", SecurityLevelStrings.learnMore);
    labelLearnMore.setAttribute("href", SecurityLevelStrings.learnMoreURL);

    let populateRadioElements = function(vboxQuery, stringStruct) {
      let vbox = groupbox.querySelector(vboxQuery);

      let radio = vbox.querySelector("radio");
      radio.setAttribute("label", stringStruct.level);

      let customWarning = vbox.querySelector("#securityLevel-customWarning");
      customWarning.setAttribute("value", SecurityLevelStrings.customWarning);

      let labelSummary = vbox.querySelector("#securityLevel-summary");
      labelSummary.textContent = stringStruct.summary;

      let labelRestoreDefaults = vbox.querySelector("#securityLevel-restoreDefaults");
      labelRestoreDefaults.setAttribute("value", SecurityLevelStrings.restoreDefaults);

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

    populateRadioElements("#securityLevel-vbox-standard", SecurityLevelStrings.standard);
    populateRadioElements("#securityLevel-vbox-safer", SecurityLevelStrings.safer);
    populateRadioElements("#securityLevel-vbox-safest", SecurityLevelStrings.safest);
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
};

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
