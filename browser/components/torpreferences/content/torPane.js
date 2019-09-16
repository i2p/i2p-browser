"use strict";

const { TorProtocolService } = ChromeUtils.import(
  "resource:///modules/TorProtocolService.jsm"
);

const {
  TorBridgeSource,
  TorBridgeSettings,
  makeTorBridgeSettingsNone,
  makeTorBridgeSettingsBuiltin,
  makeTorBridgeSettingsBridgeDB,
  makeTorBridgeSettingsUserProvided,
} = ChromeUtils.import(
  "chrome://browser/content/torpreferences/torBridgeSettings.jsm"
);

const {
  TorProxyType,
  TorProxySettings,
  makeTorProxySettingsNone,
  makeTorProxySettingsSocks4,
  makeTorProxySettingsSocks5,
  makeTorProxySettingsHTTPS,
} = ChromeUtils.import(
  "chrome://browser/content/torpreferences/torProxySettings.jsm"
);
const {
  TorFirewallSettings,
  makeTorFirewallSettingsNone,
  makeTorFirewallSettingsCustom,
} = ChromeUtils.import(
  "chrome://browser/content/torpreferences/torFirewallSettings.jsm"
);

const { TorLogDialog } = ChromeUtils.import(
  "chrome://browser/content/torpreferences/torLogDialog.jsm"
);

const { RequestBridgeDialog } = ChromeUtils.import(
  "chrome://browser/content/torpreferences/requestBridgeDialog.jsm"
);

ChromeUtils.defineModuleGetter(
  this,
  "TorStrings",
  "resource:///modules/TorStrings.jsm"
);

const { parsePort, parseBridgeStrings, parsePortList } = ChromeUtils.import(
  "chrome://browser/content/torpreferences/parseFunctions.jsm"
);

/*
  Tor Pane

  Code for populating the XUL in about:preferences#tor, handling input events, interfacing with tor-launcher
*/
const gTorPane = (function() {
  /* CSS selectors for all of the Tor Network DOM elements we need to access */
  const selectors = {
    category: {
      title: "label#torPreferences-labelCategory",
    },
    torPreferences: {
      header: "h1#torPreferences-header",
      description: "span#torPreferences-description",
      learnMore: "label#torPreferences-learnMore",
    },
    bridges: {
      header: "h2#torPreferences-bridges-header",
      description: "span#torPreferences-bridges-description",
      learnMore: "label#torPreferences-bridges-learnMore",
      useBridgeCheckbox: "checkbox#torPreferences-bridges-toggle",
      bridgeSelectionRadiogroup:
        "radiogroup#torPreferences-bridges-bridgeSelection",
      builtinBridgeOption: "radio#torPreferences-bridges-radioBuiltin",
      builtinBridgeList: "menulist#torPreferences-bridges-builtinList",
      requestBridgeOption: "radio#torPreferences-bridges-radioRequestBridge",
      requestBridgeButton: "button#torPreferences-bridges-buttonRequestBridge",
      requestBridgeTextarea:
        "textarea#torPreferences-bridges-textareaRequestBridge",
      provideBridgeOption: "radio#torPreferences-bridges-radioProvideBridge",
      provideBridgeDescription:
        "description#torPreferences-bridges-descriptionProvideBridge",
      provideBridgeTextarea:
        "textarea#torPreferences-bridges-textareaProvideBridge",
    },
    advanced: {
      header: "h2#torPreferences-advanced-header",
      description: "span#torPreferences-advanced-description",
      learnMore: "label#torPreferences-advanced-learnMore",
      useProxyCheckbox: "checkbox#torPreferences-advanced-toggleProxy",
      proxyTypeLabel: "label#torPreferences-localProxy-type",
      proxyTypeList: "menulist#torPreferences-localProxy-builtinList",
      proxyAddressLabel: "label#torPreferences-localProxy-address",
      proxyAddressTextbox: "textbox#torPreferences-localProxy-textboxAddress",
      proxyPortLabel: "label#torPreferences-localProxy-port",
      proxyPortTextbox: "input#torPreferences-localProxy-textboxPort",
      proxyUsernameLabel: "label#torPreferences-localProxy-username",
      proxyUsernameTextbox: "textbox#torPreferences-localProxy-textboxUsername",
      proxyPasswordLabel: "label#torPreferences-localProxy-password",
      proxyPasswordTextbox: "textbox#torPreferences-localProxy-textboxPassword",
      useFirewallCheckbox: "checkbox#torPreferences-advanced-toggleFirewall",
      firewallAllowedPortsLabel: "label#torPreferences-advanced-allowedPorts",
      firewallAllowedPortsTextbox:
        "textbox#torPreferences-advanced-textboxAllowedPorts",
      torLogsLabel: "label#torPreferences-torLogs",
      torLogsButton: "button#torPreferences-buttonTorLogs",
    },
  }; /* selectors */

  let retval = {
    // cached frequently accessed DOM elements
    _useBridgeCheckbox: null,
    _bridgeSelectionRadiogroup: null,
    _builtinBridgeOption: null,
    _builtinBridgeMenulist: null,
    _requestBridgeOption: null,
    _requestBridgeButton: null,
    _requestBridgeTextarea: null,
    _provideBridgeOption: null,
    _provideBridgeTextarea: null,
    _useProxyCheckbox: null,
    _proxyTypeLabel: null,
    _proxyTypeMenulist: null,
    _proxyAddressLabel: null,
    _proxyAddressTextbox: null,
    _proxyPortLabel: null,
    _proxyPortTextbox: null,
    _proxyUsernameLabel: null,
    _proxyUsernameTextbox: null,
    _proxyPasswordLabel: null,
    _proxyPasswordTextbox: null,
    _useFirewallCheckbox: null,
    _allowedPortsLabel: null,
    _allowedPortsTextbox: null,

    // tor network settings
    _bridgeSettings: null,
    _proxySettings: null,
    _firewallSettings: null,

    // disables the provided list of elements
    _setElementsDisabled(elements, disabled) {
      for (let currentElement of elements) {
        currentElement.disabled = disabled;
      }
    },

    // populate xul with strings and cache the relevant elements
    _populateXUL() {
      // saves tor settings to disk when navigate away from about:preferences
      window.addEventListener("blur", val => {
        TorProtocolService.flushSettings();
      });

      document
        .querySelector(selectors.category.title)
        .setAttribute("value", TorStrings.settings.categoryTitle);

      let prefpane = document.getElementById("mainPrefPane");

      // Heading
      prefpane.querySelector(selectors.torPreferences.header).innerText =
        TorStrings.settings.torPreferencesHeading;
      prefpane.querySelector(selectors.torPreferences.description).textContent =
        TorStrings.settings.torPreferencesDescription;
      {
        let learnMore = prefpane.querySelector(
          selectors.torPreferences.learnMore
        );
        learnMore.setAttribute("value", TorStrings.settings.learnMore);
        learnMore.setAttribute(
          "href",
          TorStrings.settings.learnMoreTorBrowserURL
        );
      }

      // Bridge setup
      prefpane.querySelector(selectors.bridges.header).innerText =
        TorStrings.settings.bridgesHeading;
      prefpane.querySelector(selectors.bridges.description).textContent =
        TorStrings.settings.bridgesDescription;
      {
        let learnMore = prefpane.querySelector(selectors.bridges.learnMore);
        learnMore.setAttribute("value", TorStrings.settings.learnMore);
        learnMore.setAttribute("href", TorStrings.settings.learnMoreBridgesURL);
      }

      this._useBridgeCheckbox = prefpane.querySelector(
        selectors.bridges.useBridgeCheckbox
      );
      this._useBridgeCheckbox.setAttribute(
        "label",
        TorStrings.settings.useBridge
      );
      this._bridgeSelectionRadiogroup = prefpane.querySelector(
        selectors.bridges.bridgeSelectionRadiogroup
      );
      this._bridgeSelectionRadiogroup.value = TorBridgeSource.BUILTIN;

      // Builtin bridges
      this._builtinBridgeOption = prefpane.querySelector(
        selectors.bridges.builtinBridgeOption
      );
      this._builtinBridgeOption.setAttribute(
        "label",
        TorStrings.settings.selectBridge
      );
      this._builtinBridgeOption.setAttribute("value", TorBridgeSource.BUILTIN);
      this._builtinBridgeMenulist = prefpane.querySelector(
        selectors.bridges.builtinBridgeList
      );

      // Request bridge
      this._requestBridgeOption = prefpane.querySelector(
        selectors.bridges.requestBridgeOption
      );
      this._requestBridgeOption.setAttribute(
        "label",
        TorStrings.settings.requestBridgeFromTorProject
      );
      this._requestBridgeOption.setAttribute("value", TorBridgeSource.BRIDGEDB);
      this._requestBridgeButton = prefpane.querySelector(
        selectors.bridges.requestBridgeButton
      );
      this._requestBridgeButton.setAttribute(
        "label",
        TorStrings.settings.requestNewBridge
      );
      this._requestBridgeTextarea = prefpane.querySelector(
        selectors.bridges.requestBridgeTextarea
      );

      // Provide a bridge
      this._provideBridgeOption = prefpane.querySelector(
        selectors.bridges.provideBridgeOption
      );
      this._provideBridgeOption.setAttribute(
        "label",
        TorStrings.settings.provideBridge
      );
      this._provideBridgeOption.setAttribute(
        "value",
        TorBridgeSource.USERPROVIDED
      );
      prefpane.querySelector(
        selectors.bridges.provideBridgeDescription
      ).textContent = TorStrings.settings.provideBridgeDirections;
      this._provideBridgeTextarea = prefpane.querySelector(
        selectors.bridges.provideBridgeTextarea
      );
      this._provideBridgeTextarea.setAttribute(
        "placeholder",
        TorStrings.settings.provideBridgePlaceholder
      );

      // Advanced setup
      prefpane.querySelector(selectors.advanced.header).innerText =
        TorStrings.settings.advancedHeading;
      prefpane.querySelector(selectors.advanced.description).textContent =
        TorStrings.settings.advancedDescription;
      {
        let learnMore = prefpane.querySelector(selectors.advanced.learnMore);
        learnMore.setAttribute("value", TorStrings.settings.learnMore);
        learnMore.setAttribute(
          "href",
          TorStrings.settings.learnMoreNetworkSettingsURL
        );
      }

      // Local Proxy
      this._useProxyCheckbox = prefpane.querySelector(
        selectors.advanced.useProxyCheckbox
      );
      this._useProxyCheckbox.setAttribute(
        "label",
        TorStrings.settings.useLocalProxy
      );
      this._proxyTypeLabel = prefpane.querySelector(
        selectors.advanced.proxyTypeLabel
      );
      this._proxyTypeLabel.setAttribute("value", TorStrings.settings.proxyType);

      let mockProxies = [
        {
          value: TorProxyType.SOCKS4,
          label: TorStrings.settings.proxyTypeSOCKS4,
        },
        {
          value: TorProxyType.SOCKS5,
          label: TorStrings.settings.proxyTypeSOCKS5,
        },
        { value: TorProxyType.HTTPS, label: TorStrings.settings.proxyTypeHTTP },
      ];
      this._proxyTypeMenulist = prefpane.querySelector(
        selectors.advanced.proxyTypeList
      );
      for (let currentProxy of mockProxies) {
        let menuEntry = document.createElement("menuitem");
        menuEntry.setAttribute("value", currentProxy.value);
        menuEntry.setAttribute("label", currentProxy.label);
        this._proxyTypeMenulist.querySelector("menupopup").append(menuEntry);
      }

      this._proxyAddressLabel = prefpane.querySelector(
        selectors.advanced.proxyAddressLabel
      );
      this._proxyAddressLabel.setAttribute(
        "value",
        TorStrings.settings.proxyAddress
      );
      this._proxyAddressTextbox = prefpane.querySelector(
        selectors.advanced.proxyAddressTextbox
      );
      this._proxyAddressTextbox.setAttribute(
        "placeholder",
        TorStrings.settings.proxyAddressPlaceholder
      );
      this._proxyPortLabel = prefpane.querySelector(
        selectors.advanced.proxyPortLabel
      );
      this._proxyPortLabel.setAttribute("value", TorStrings.settings.proxyPort);
      this._proxyPortTextbox = prefpane.querySelector(
        selectors.advanced.proxyPortTextbox
      );
      this._proxyUsernameLabel = prefpane.querySelector(
        selectors.advanced.proxyUsernameLabel
      );
      this._proxyUsernameLabel.setAttribute(
        "value",
        TorStrings.settings.proxyUsername
      );
      this._proxyUsernameTextbox = prefpane.querySelector(
        selectors.advanced.proxyUsernameTextbox
      );
      this._proxyUsernameTextbox.setAttribute(
        "placeholder",
        TorStrings.settings.proxyUsernamePasswordPlaceholder
      );
      this._proxyPasswordLabel = prefpane.querySelector(
        selectors.advanced.proxyPasswordLabel
      );
      this._proxyPasswordLabel.setAttribute(
        "value",
        TorStrings.settings.proxyPassword
      );
      this._proxyPasswordTextbox = prefpane.querySelector(
        selectors.advanced.proxyPasswordTextbox
      );
      this._proxyPasswordTextbox.setAttribute(
        "placeholder",
        TorStrings.settings.proxyUsernamePasswordPlaceholder
      );

      // Local firewall
      this._useFirewallCheckbox = prefpane.querySelector(
        selectors.advanced.useFirewallCheckbox
      );
      this._useFirewallCheckbox.setAttribute(
        "label",
        TorStrings.settings.useFirewall
      );
      this._allowedPortsLabel = prefpane.querySelector(
        selectors.advanced.firewallAllowedPortsLabel
      );
      this._allowedPortsLabel.setAttribute(
        "value",
        TorStrings.settings.allowedPorts
      );
      this._allowedPortsTextbox = prefpane.querySelector(
        selectors.advanced.firewallAllowedPortsTextbox
      );
      this._allowedPortsTextbox.setAttribute(
        "placeholder",
        TorStrings.settings.allowedPortsPlaceholder
      );

      // Tor logs
      prefpane
        .querySelector(selectors.advanced.torLogsLabel)
        .setAttribute("value", TorStrings.settings.showTorDaemonLogs);
      prefpane
        .querySelector(selectors.advanced.torLogsButton)
        .setAttribute("label", TorStrings.settings.showLogs);

      // Disable all relevant elements by default
      this._setElementsDisabled(
        [
          this._builtinBridgeOption,
          this._builtinBridgeMenulist,
          this._requestBridgeOption,
          this._requestBridgeButton,
          this._requestBridgeTextarea,
          this._provideBridgeOption,
          this._provideBridgeTextarea,
          this._proxyTypeLabel,
          this._proxyTypeMenulist,
          this._proxyAddressLabel,
          this._proxyAddressTextbox,
          this._proxyPortLabel,
          this._proxyPortTextbox,
          this._proxyUsernameLabel,
          this._proxyUsernameTextbox,
          this._proxyPasswordLabel,
          this._proxyPasswordTextbox,
          this._allowedPortsLabel,
          this._allowedPortsTextbox,
        ],
        true
      );

      // load bridge settings
      let torBridgeSettings = new TorBridgeSettings();
      torBridgeSettings.readSettings();

      // populate the bridge list
      for (let currentBridge of TorBridgeSettings.defaultBridgeTypes) {
        let menuEntry = document.createElement("menuitem");
        menuEntry.setAttribute("value", currentBridge);
        menuEntry.setAttribute("label", currentBridge);
        this._builtinBridgeMenulist
          .querySelector("menupopup")
          .append(menuEntry);
      }

      this.onSelectBridgeOption(torBridgeSettings.bridgeSource);
      this.onToggleBridge(
        torBridgeSettings.bridgeSource != TorBridgeSource.NONE
      );
      switch (torBridgeSettings.bridgeSource) {
        case TorBridgeSource.NONE:
          break;
        case TorBridgeSource.BUILTIN:
          this._builtinBridgeMenulist.value =
            torBridgeSettings.selectedDefaultBridgeType;
          break;
        case TorBridgeSource.BRIDGEDB:
          this._requestBridgeTextarea.value = torBridgeSettings.bridgeStrings;
          break;
        case TorBridgeSource.USERPROVIDED:
          this._provideBridgeTextarea.value = torBridgeSettings.bridgeStrings;
          break;
      }

      this._bridgeSettings = torBridgeSettings;

      // load proxy settings
      let torProxySettings = new TorProxySettings();
      torProxySettings.readSettings();

      if (torProxySettings.type != TorProxyType.NONE) {
        this.onToggleProxy(true);
        this.onSelectProxyType(torProxySettings.type);
        this._proxyAddressTextbox.value = torProxySettings.address;
        this._proxyPortTextbox.value = torProxySettings.port;
        this._proxyUsernameTextbox.value = torProxySettings.username;
        this._proxyPasswordTextbox.value = torProxySettings.password;
      }

      this._proxySettings = torProxySettings;

      // load firewall settings
      let torFirewallSettings = new TorFirewallSettings();
      torFirewallSettings.readSettings();

      if (torFirewallSettings.hasPorts) {
        this.onToggleFirewall(true);
        this._allowedPortsTextbox.value =
          torFirewallSettings.commaSeparatedListString;
      }

      this._firewallSettings = torFirewallSettings;
    },

    init() {
      this._populateXUL();
    },

    // whether the page should be present in about:preferences
    get enabled() {
      return TorProtocolService.ownsTorDaemon;
    },

    //
    // Callbacks
    //

    // callback when using bridges toggled
    onToggleBridge(enabled) {
      this._useBridgeCheckbox.checked = enabled;
      let disabled = !enabled;

      // first disable all the bridge related elements
      this._setElementsDisabled(
        [
          this._builtinBridgeOption,
          this._builtinBridgeMenulist,
          this._requestBridgeOption,
          this._requestBridgeButton,
          this._requestBridgeTextarea,
          this._provideBridgeOption,
          this._provideBridgeTextarea,
        ],
        disabled
      );

      // and selectively re-enable based on the radiogroup's current value
      if (enabled) {
        this.onSelectBridgeOption(this._bridgeSelectionRadiogroup.value);
      } else {
        this.onSelectBridgeOption(TorBridgeSource.NONE);
      }
      return this;
    },

    // callback when a bridge option is selected
    onSelectBridgeOption(source) {
      // disable all of the bridge elements under radio buttons
      this._setElementsDisabled(
        [
          this._builtinBridgeMenulist,
          this._requestBridgeButton,
          this._requestBridgeTextarea,
          this._provideBridgeTextarea,
        ],
        true
      );

      if (source != TorBridgeSource.NONE) {
        this._bridgeSelectionRadiogroup.value = source;
      }

      switch (source) {
        case TorBridgeSource.BUILTIN: {
          this._setElementsDisabled([this._builtinBridgeMenulist], false);
          break;
        }
        case TorBridgeSource.BRIDGEDB: {
          this._setElementsDisabled(
            [this._requestBridgeButton, this._requestBridgeTextarea],
            false
          );
          break;
        }
        case TorBridgeSource.USERPROVIDED: {
          this._setElementsDisabled([this._provideBridgeTextarea], false);
          break;
        }
      }
      return this;
    },

    // called when the request brige button is activated
    onRequestBridge() {
      let requestBridgeDialog = new RequestBridgeDialog();
      requestBridgeDialog.openDialog(
        gSubDialog,
        this._proxySettings.proxyURI,
        aBridges => {
          if (aBridges.length > 0) {
            let bridgeSettings = makeTorBridgeSettingsBridgeDB(aBridges);
            bridgeSettings.writeSettings();
            this._bridgeSettings = bridgeSettings;

            this._requestBridgeTextarea.value = bridgeSettings.bridgeStrings;
          }
        }
      );
      return this;
    },

    // pushes bridge settings from UI to tor
    onUpdateBridgeSettings() {
      let bridgeSettings = null;

      let source = this._useBridgeCheckbox.checked
        ? this._bridgeSelectionRadiogroup.value
        : TorBridgeSource.NONE;
      switch (source) {
        case TorBridgeSource.NONE: {
          bridgeSettings = makeTorBridgeSettingsNone();
          break;
        }
        case TorBridgeSource.BUILTIN: {
          // if there is a built-in bridge already selected, use that
          let bridgeType = this._builtinBridgeMenulist.value;
          if (bridgeType) {
            bridgeSettings = makeTorBridgeSettingsBuiltin(bridgeType);
          } else {
            bridgeSettings = makeTorBridgeSettingsNone();
          }
          break;
        }
        case TorBridgeSource.BRIDGEDB: {
          // if there are bridgedb bridges saved in the text area, use them
          let bridgeStrings = this._requestBridgeTextarea.value;
          if (bridgeStrings) {
            let bridgeStringList = parseBridgeStrings(bridgeStrings);
            bridgeSettings = makeTorBridgeSettingsBridgeDB(bridgeStringList);
          } else {
            bridgeSettings = makeTorBridgeSettingsNone();
          }
          break;
        }
        case TorBridgeSource.USERPROVIDED: {
          // if bridges already exist in the text area, use them
          let bridgeStrings = this._provideBridgeTextarea.value;
          if (bridgeStrings) {
            let bridgeStringList = parseBridgeStrings(bridgeStrings);
            bridgeSettings = makeTorBridgeSettingsUserProvided(
              bridgeStringList
            );
          } else {
            bridgeSettings = makeTorBridgeSettingsNone();
          }
          break;
        }
      }
      bridgeSettings.writeSettings();
      this._bridgeSettings = bridgeSettings;
      return this;
    },

    // callback when proxy is toggled
    onToggleProxy(enabled) {
      this._useProxyCheckbox.checked = enabled;
      let disabled = !enabled;

      this._setElementsDisabled(
        [
          this._proxyTypeLabel,
          this._proxyTypeMenulist,
          this._proxyAddressLabel,
          this._proxyAddressTextbox,
          this._proxyPortLabel,
          this._proxyPortTextbox,
          this._proxyUsernameLabel,
          this._proxyUsernameTextbox,
          this._proxyPasswordLabel,
          this._proxyPasswordTextbox,
        ],
        disabled
      );
      this.onSelectProxyType(this._proxyTypeMenulist.value);
      return this;
    },

    // callback when proxy type is changed
    onSelectProxyType(value) {
      if (value == "") {
        value = TorProxyType.NONE;
      }
      this._proxyTypeMenulist.value = value;
      switch (value) {
        case TorProxyType.NONE: {
          this._setElementsDisabled(
            [
              this._proxyAddressLabel,
              this._proxyAddressTextbox,
              this._proxyPortLabel,
              this._proxyPortTextbox,
              this._proxyUsernameLabel,
              this._proxyUsernameTextbox,
              this._proxyPasswordLabel,
              this._proxyPasswordTextbox,
            ],
            true
          ); // DISABLE

          this._proxyAddressTextbox.value = "";
          this._proxyPortTextbox.value = "";
          this._proxyUsernameTextbox.value = "";
          this._proxyPasswordTextbox.value = "";
          break;
        }
        case TorProxyType.SOCKS4: {
          this._setElementsDisabled(
            [
              this._proxyAddressLabel,
              this._proxyAddressTextbox,
              this._proxyPortLabel,
              this._proxyPortTextbox,
            ],
            false
          ); // ENABLE
          this._setElementsDisabled(
            [
              this._proxyUsernameLabel,
              this._proxyUsernameTextbox,
              this._proxyPasswordLabel,
              this._proxyPasswordTextbox,
            ],
            true
          ); // DISABLE

          this._proxyUsernameTextbox.value = "";
          this._proxyPasswordTextbox.value = "";
          break;
        }
        case TorProxyType.SOCKS5:
        case TorProxyType.HTTPS: {
          this._setElementsDisabled(
            [
              this._proxyAddressLabel,
              this._proxyAddressTextbox,
              this._proxyPortLabel,
              this._proxyPortTextbox,
              this._proxyUsernameLabel,
              this._proxyUsernameTextbox,
              this._proxyPasswordLabel,
              this._proxyPasswordTextbox,
            ],
            false
          ); // ENABLE
          break;
        }
      }
      return this;
    },

    // pushes proxy settings from UI to tor
    onUpdateProxySettings() {
      const proxyType = this._useProxyCheckbox.checked
        ? this._proxyTypeMenulist.value
        : TorProxyType.NONE;
      const addressString = this._proxyAddressTextbox.value;
      const portString = this._proxyPortTextbox.value;
      const usernameString = this._proxyUsernameTextbox.value;
      const passwordString = this._proxyPasswordTextbox.value;

      let proxySettings = null;

      switch (proxyType) {
        case TorProxyType.NONE:
          proxySettings = makeTorProxySettingsNone();
          break;
        case TorProxyType.SOCKS4:
          proxySettings = makeTorProxySettingsSocks4(
            addressString,
            parsePort(portString)
          );
          break;
        case TorProxyType.SOCKS5:
          proxySettings = makeTorProxySettingsSocks5(
            addressString,
            parsePort(portString),
            usernameString,
            passwordString
          );
          break;
        case TorProxyType.HTTPS:
          proxySettings = makeTorProxySettingsHTTPS(
            addressString,
            parsePort(portString),
            usernameString,
            passwordString
          );
          break;
      }

      proxySettings.writeSettings();
      this._proxySettings = proxySettings;
      return this;
    },

    // callback when firewall proxy is toggled
    onToggleFirewall(enabled) {
      this._useFirewallCheckbox.checked = enabled;
      let disabled = !enabled;

      this._setElementsDisabled(
        [this._allowedPortsLabel, this._allowedPortsTextbox],
        disabled
      );

      return this;
    },

    // pushes firewall settings from UI to tor
    onUpdateFirewallSettings() {
      let portListString = this._useFirewallCheckbox.checked
        ? this._allowedPortsTextbox.value
        : "";
      let firewallSettings = null;

      if (portListString) {
        firewallSettings = makeTorFirewallSettingsCustom(
          parsePortList(portListString)
        );
      } else {
        firewallSettings = makeTorFirewallSettingsNone();
      }

      firewallSettings.writeSettings();
      this._firewallSettings = firewallSettings;
      return this;
    },

    onViewTorLogs() {
      let torLogDialog = new TorLogDialog();
      torLogDialog.openDialog(gSubDialog);
    },
  };
  return retval;
})(); /* gTorPane */
