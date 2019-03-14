/* -*- Mode: Java; c-basic-offset: 4; tab-width: 4; indent-tabs-mode: nil; -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko.torbootstrap;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Handler;
import android.os.Message;
import android.support.v4.content.LocalBroadcastManager;

import org.torproject.android.service.OrbotConstants;
import org.torproject.android.service.TorService;
import org.torproject.android.service.TorServiceConstants;
import org.torproject.android.service.util.TorServiceUtils;

import java.util.Vector;


/**
 * This is simply a container for capturing the log events and proxying them
 * to the TorBootstrapLogger implementers (TorBootstrapPanel and TorBootstrapLogPanel now).
 *
 * This should be in BrowserApp, but that class/Activity is already too large,
 * so this should be easier to reason about.
 */
public class TorLogEventListener {

    private static Vector<TorBootstrapLogger> mLoggers;

    private TorLogEventListener instance;
    private static boolean isInitialized = false;

    public TorLogEventListener getInstance(Context context) {
        if (instance == null) {
            instance = new TorLogEventListener();
        }
        return instance;
    }

    private synchronized static void initialize(Context context) {
        LocalBroadcastManager lbm = LocalBroadcastManager.getInstance(context);
        lbm.registerReceiver(mLocalBroadcastReceiver,
                new IntentFilter(TorServiceConstants.ACTION_STATUS));
        lbm.registerReceiver(mLocalBroadcastReceiver,
                new IntentFilter(TorServiceConstants.LOCAL_ACTION_LOG));

        isInitialized = true;
        // There should be at least two Loggers: TorBootstrapPanel
        // and TorBootstrapLogPanel
        mLoggers = new Vector<TorBootstrapLogger>(2);
    }

    public synchronized static void addLogger(TorBootstrapLogger logger) {
        if (!isInitialized) {
            // This is an assumption we're making. All Loggers are a subclass
            // of an Activity.
            Activity activity = logger.getActivity();
            initialize(activity);
        }

        if (mLoggers.contains(logger)) {
            return;
        }
        mLoggers.add(logger);
    }

    public synchronized static void deleteLogger(TorBootstrapLogger logger) {
        mLoggers.remove(logger);
    }

    /**
     * The state and log info from {@link TorService} are sent to the UI here in
     * the form of a local broadcast. Regular broadcasts can be sent by any app,
     * so local ones are used here so other apps cannot interfere with Orbot's
     * operation.
     *
     * Copied from Orbot - OrbotMainActivity.java
     */
    private static BroadcastReceiver mLocalBroadcastReceiver = new BroadcastReceiver() {

        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (action == null) {
                return;
            }

            // This is only defined for log updates
            if (!action.equals(TorServiceConstants.LOCAL_ACTION_LOG) &&
                !action.equals(TorServiceConstants.ACTION_STATUS)) {
                return;
            }

            Message msg = mStatusUpdateHandler.obtainMessage();

            if (action.equals(TorServiceConstants.LOCAL_ACTION_LOG)) {
                msg.obj = intent.getStringExtra(TorServiceConstants.LOCAL_EXTRA_LOG);
            }

            msg.getData().putString("status",
                                    intent.getStringExtra(TorServiceConstants.EXTRA_STATUS));
            mStatusUpdateHandler.sendMessage(msg);
        }
    };


    // this is what takes messages or values from the callback threads or other non-mainUI threads
    // and passes them back into the main UI thread for display to the user
    private static Handler mStatusUpdateHandler = new Handler() {

        @Override
        public void handleMessage(final Message msg) {
           String newTorStatus = msg.getData().getString("status");
           String log = (String)msg.obj;

           for (TorBootstrapLogger l : mLoggers) {
               l.updateStatus(log, newTorStatus);
           }
           super.handleMessage(msg);
        }
    };
}
