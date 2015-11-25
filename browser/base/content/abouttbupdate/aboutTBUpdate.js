// Copyright (c) 2019, The Tor Project, Inc.
// See LICENSE for licensing information.
//
// vim: set sw=2 sts=2 ts=8 et syntax=javascript:


addEventListener("load", () => {
  let event = new CustomEvent("AboutTBUpdateLoad", { bubbles: true });
  document.dispatchEvent(event);
});
