/* -*- Mode: Java; c-basic-offset: 4; tab-width: 4; indent-tabs-mode: nil; -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko.torbootstrap;

import android.app.Activity;

// Simple interface for a logger.
//
// The current implementers are TorBootstrapPanel and
// TorBootstrapLogPanel.
public interface TorBootstrapLogger {
    public void updateStatus(String torServiceMsg, String newTorStatus);
    public Activity getActivity();
}
