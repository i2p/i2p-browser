"use strict";

var EXPORTED_SYMBOLS = [
  "parsePort",
  "parseAddrPort",
  "parseUsernamePassword",
  "parseAddrPortList",
  "parseBridgeStrings",
  "parsePortList",
];

// expects a string representation of an integer from 1 to 65535
let parsePort = function(aPort) {
  // ensure port string is a valid positive integer
  const validIntRegex = /^[0-9]+$/;
  if (!validIntRegex.test(aPort)) {
    throw new Error(`Invalid PORT string : '${aPort}'`);
  }

  // ensure port value is on valid range
  let port = Number.parseInt(aPort);
  if (port < 1 || port > 65535) {
    throw new Error(
      `Invalid PORT value, needs to be on range [1,65535] : '${port}'`
    );
  }

  return port;
};
// expects a string in the format: "ADDRESS:PORT"
let parseAddrPort = function(aAddrColonPort) {
  let tokens = aAddrColonPort.split(":");
  if (tokens.length != 2) {
    throw new Error(`Invalid ADDRESS:PORT string : '${aAddrColonPort}'`);
  }
  let address = tokens[0];
  let port = parsePort(tokens[1]);
  return [address, port];
};

// expects a string in the format: "USERNAME:PASSWORD"
// split on the first colon and any subsequent go into password
let parseUsernamePassword = function(aUsernameColonPassword) {
  let colonIndex = aUsernameColonPassword.indexOf(":");
  if (colonIndex < 0) {
    // we don't log the contents of the potentially password containing string
    throw new Error("Invalid USERNAME:PASSWORD string");
  }

  let username = aUsernameColonPassword.substring(0, colonIndex);
  let password = aUsernameColonPassword.substring(colonIndex + 1);

  return [username, password];
};

// expects a string in the format: ADDRESS:PORT,ADDRESS:PORT,...
// returns array of ports (as ints)
let parseAddrPortList = function(aAddrPortList) {
  let addrPorts = aAddrPortList.split(",");
  // parse ADDRESS:PORT string and only keep the port (second element in returned array)
  let retval = addrPorts.map(addrPort => parseAddrPort(addrPort)[1]);
  return retval;
};

// expects a '/n' or '/r/n' delimited bridge string, which we split and trim
// each bridge string can also optionally have 'bridge' at the beginning ie:
// bridge $(type) $(address):$(port) $(certificate)
// we strip out the 'bridge' prefix here
let parseBridgeStrings = function(aBridgeStrings) {

  // replace carriage returns ('\r') with new lines ('\n')
  aBridgeStrings = aBridgeStrings.replace(/\r/g, "\n");
  // then replace contiguous new lines ('\n') with a single one
  aBridgeStrings = aBridgeStrings.replace(/[\n]+/g, "\n");

  // split on the newline and for each bridge string: trim, remove starting 'bridge' string
  // finally discard entries that are empty strings; empty strings could occur if we receive
  // a new line containing only whitespace
  let splitStrings = aBridgeStrings.split("\n");
  return splitStrings.map(val => val.trim().replace(/^bridge\s+/i, ""))
                     .filter(bridgeString => bridgeString != "");
};

// expecting a ',' delimited list of ints with possible white space between
// returns an array of ints
let parsePortList = function(aPortListString) {
  let splitStrings = aPortListString.split(",");
  return splitStrings.map(val => parsePort(val.trim()));
};
