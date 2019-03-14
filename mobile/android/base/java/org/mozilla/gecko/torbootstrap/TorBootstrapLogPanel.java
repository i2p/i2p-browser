/* -*- Mode: Java; c-basic-offset: 4; tab-width: 4; indent-tabs-mode: nil; -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko.torbootstrap;

import android.os.Bundle;
import android.support.v4.app.Fragment;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;
import org.mozilla.gecko.R;

/**
 * Simple subclass of TorBootstrapPanel specifically for showing
 * Tor and Orbot log entries.
 */
public class TorBootstrapLogPanel extends TorBootstrapPanel {

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container, Bundle savedInstance) {
        mRoot = (ViewGroup) inflater.inflate(R.layout.tor_bootstrap_log, container, false);

        if (mRoot == null) {
            Log.w(LOGTAG, "Inflating R.layout.tor_bootstrap returned null");
            return null;
        }

        TorLogEventListener.addLogger(this);

        return mRoot;
    }

    @Override
    public void onViewCreated(View view, Bundle savedInstance) {
        super.onViewCreated(view, savedInstance);
        // Inherited from the super class
        configureGearCogClickHandler();
    }

    // TODO Add a button for Go-to-bottom
    @Override
    public void updateStatus(String torServiceMsg, String newTorStatus) {
        if (torServiceMsg == null) {
            return;
        }
        TextView torLog = (TextView) mRoot.findViewById(R.id.tor_bootstrap_last_status_message);
        torLog.append("- " + torServiceMsg + "\n");
    }
}
