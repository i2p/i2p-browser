// Copyright (c) 2019, The Tor Project, Inc.
// See LICENSE for licensing information.
//
// vim: set sw=2 sts=2 ts=8 et syntax=javascript:

var EXPORTED_SYMBOLS = ["AboutTBUpdateChild"];

const {ActorChild} = ChromeUtils.import("resource://gre/modules/ActorChild.jsm");

class AboutTBUpdateChild extends ActorChild {
  receiveMessage(aMessage) {
    if (aMessage.name == "AboutTBUpdate:Update")
      this.onUpdate(aMessage.data);
  }

  handleEvent(aEvent) {
    switch (aEvent.type) {
      case "AboutTBUpdateLoad":
        this.onPageLoad();
        break;
      case "pagehide":
        this.onPageHide(aEvent);
        break;
    }
  }

  // aData may contain the following string properties:
  //   version
  //   releaseDate
  //   moreInfoURL
  //   releaseNotes
  onUpdate(aData) {
    let doc = this.content.document;
    doc.getElementById("version-content").textContent = aData.version;
    if (aData.releaseDate) {
      doc.body.setAttribute("havereleasedate", "true");
      doc.getElementById("releasedate-content").textContent = aData.releaseDate;
    }
    if (aData.moreInfoURL)
      doc.getElementById("infolink").setAttribute("href", aData.moreInfoURL);
    doc.getElementById("releasenotes-content").textContent = aData.releaseNotes;
  }

  onPageLoad() {
    this.mm.sendAsyncMessage("AboutTBUpdate:RequestUpdate");
  }

  onPageHide(aEvent) {
    if (aEvent.target.defaultView.frameElement) {
      return;
    }
  }
}
