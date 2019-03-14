/* -*- Mode: Java; c-basic-offset: 4; tab-width: 4; indent-tabs-mode: nil; -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko.torbootstrap;

import android.app.Activity;
import android.content.Intent;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.os.Bundle;
import android.support.v4.app.Fragment;
import android.support.v4.content.LocalBroadcastManager;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;
import android.util.Log;
import org.mozilla.gecko.R;
import org.mozilla.gecko.Telemetry;
import org.mozilla.gecko.TelemetryContract;
import org.mozilla.gecko.firstrun.FirstrunPanel;

import org.torproject.android.service.OrbotConstants;
import org.torproject.android.service.TorService;
import org.torproject.android.service.TorServiceConstants;
import org.torproject.android.service.util.TorServiceUtils;


/**
 * Tor Bootstrap panel (fragment/screen)
 *
 * This is based on the Firstrun Panel for simplicity.
 */
public class TorBootstrapPanel extends FirstrunPanel implements TorBootstrapLogger {

    protected static final String LOGTAG = "TorBootstrap";

    protected ViewGroup mRoot;
    protected Activity mActContext;
    protected TorBootstrapPager.TorBootstrapController mBootstrapController;

    private ViewTreeLayoutListener mViewTreeLayoutListener;

    // These are used by the background AlphaChanging thread for dynamically changing
    // the alpha value of the Onion during bootstrap.
    private int mOnionCurrentAlpha = 255;
    // This is either +1 or -1, depending on the direction of the change.
    private int mOnionCurrentAlphaDirection = -1;
    private Object mOnionAlphaChangerLock = new Object();
    private boolean mOnionAlphaChangerRunning = false;

    // Runnable for changing the alpha of the Onion image every 100 milliseconds.
    // It gradually increases and then decreases the alpha in the background and
    // then applies the new alpha on the UI thread.
    private Thread mChangeOnionAlphaThread = null;
    final private class ChangeOnionAlphaRunnable implements Runnable {
        @Override
        public void run() {
            while (true) {
                 synchronized(mOnionAlphaChangerLock) {
                     // Stop the animation and terminate this thread if the main thread
                     // set |mOnionAlphaChangerRunning| to |false| or if
                     // getActivity() returns |null|.
                     if (!mOnionAlphaChangerRunning || getActivity() == null) {
                         // Null the reference for this thread when we exit
                         mChangeOnionAlphaThread = null;
                         return;
                     }
                 }

                 // Choose the new value here, mOnionCurrentAlpha is set in setOnionAlphaValue()
                 // Increase by 5 if mOnionCurrentAlphaDirection is positive, and decrease by
                 // 5 if mOnionCurrentAlphaDirection is negative.
                 final int newAlpha = mOnionCurrentAlpha + mOnionCurrentAlphaDirection*5;
                 getActivity().runOnUiThread(new Runnable() {
                      public void run() {
                          setOnionAlphaValue(newAlpha);
                      }
                 });

                 try {
                     Thread.sleep(100);
                 } catch (InterruptedException e) {}
            }
        }
    }

    // Android tries scaling the image as a square. Create a modified ViewPort via padding
    // top, left, right, and bottom such that the image aspect ratio is correct.
    private void setOnionImgLayout() {
        if (mRoot == null) {
            Log.i(LOGTAG, "setOnionImgLayout: mRoot is null");
            return;
        }

        ImageView onionImg = (ImageView) mRoot.findViewById(R.id.tor_bootstrap_onion);
        if (onionImg == null) {
            Log.i(LOGTAG, "setOnionImgLayout: onionImg is null");
            return;
        }

        // Dimensions of the SVG. If the image is ever changed, update these values. The
        // SVG viewport is 2dp wider due to clipping.
        final double imgHeight = 289.;
        final double imgWidth = 247.;

        // Dimensions of the current ImageView
        final int currentHeight = onionImg.getHeight();
        final int currentWidth = onionImg.getWidth();

        // If we only consider one dimension of the image, calculate the expected value
        // of the other dimension (width vs. height).
        final int expectedHeight = (int) (currentWidth*imgHeight/imgWidth);
        final int expectedWidth = (int) (currentHeight*imgWidth/imgHeight);

        // Set current values as default.
        int newWidth = currentWidth;
        int newHeight = currentHeight;

        Log.d(LOGTAG, "Current Top=" + onionImg.getTop());
        Log.d(LOGTAG, "Current Height=" + currentHeight);
        Log.d(LOGTAG, "Current Width=" + currentWidth);
        Log.d(LOGTAG, "Expected height=" + expectedHeight);
        Log.d(LOGTAG, "Expected width=" + expectedWidth);

        // Configure the width or height based on its expected value. This is based on
        // the intuition that:
        //   - If the device is in portrait mode, then the device's height is (likely)
        //     greater than its width. When this is the case, then:
        //         - The image's View object is likely using all available vertical area
        //             (but the image is bounded by the width of the device due to
        //             maintaining the scaling factor).
        //         - However, the height and width of the graphic are equal (because
        //             Android enforces this).
        //         - The width should be less than the height (this is a property of
        //             the image itself).
        //         - The width should be proportional to the imgHeight and imgWidth
        //             defined above.
        //     Adjust the height when the current width is less than the expected width.
        //     The width is the limiting-factor, therefore choose the height proportional
        //     to the current width.
        //
        //   - The opposite is likely true when the device is in landscape mode with
        //     respect to the height and width. Adjust the width when the height is less
        //     than the expected height. The height is the limiting-factor, therefore
        //     choose the width proportional to the current height.
        //
        // Subtract 1 from the expected value as a way of accounting for rounding
        // error.
        if (currentWidth < (expectedWidth - 1)) {
            newHeight = expectedHeight;
        } else if (currentHeight < (expectedHeight - 1)) {
            newWidth = expectedWidth;
        }

        Log.d(LOGTAG, "New height=" + newHeight);
        Log.d(LOGTAG, "New width=" + newWidth);

        // Define the padding as the available space between the current height (as it
        // is displayed to the user) and the new height (as it was calculated above).
        int verticalPadding = currentHeight - newHeight;
        int sidePadding = currentWidth - newWidth;
        int leftPadding = 0;
        int topPadding = 0;
        int bottomPadding = 0;
        int rightPadding = 0;

        // If the width of the image is greater than 600dp, then cap it at 702x600 (HxW).
        // Furthermore, if the width is "near" 600dp (within 100dp), then decrease the
        // dimensions to 468x400 dp. This should "look" better on lower-resolution
        // devices.
        final int MAXIMUM_WIDTH = 600;
        final int distanceFromMaxWidth = newWidth - MAXIMUM_WIDTH;
        final boolean isNearMaxWidth = Math.abs(distanceFromMaxWidth) < 100;
        if ((newWidth > MAXIMUM_WIDTH) || isNearMaxWidth) {
            if (isNearMaxWidth) {
                // If newWidth is near MAX_WIDTH, then add additional padding (therefore
                // decreasing the width by an additional 200dp).
                sidePadding += 200;
            }

            final int paddingSpaceAvailable = (distanceFromMaxWidth > 0) ? distanceFromMaxWidth : 0;
            sidePadding += paddingSpaceAvailable;

            final int newWidthWithoutPadding = currentWidth - sidePadding;

            final int newHeightWithoutPadding = (int) (newWidthWithoutPadding*imgHeight/imgWidth);

            Log.d(LOGTAG, "New width without padding=" + newWidthWithoutPadding);
            Log.d(LOGTAG, "New height without padding=" + newHeightWithoutPadding);

            verticalPadding = currentHeight - newHeightWithoutPadding;
        }

        Log.d(LOGTAG, "New top padding=" + verticalPadding);
        Log.d(LOGTAG, "New side padding=" + sidePadding);

        if (verticalPadding < 0) {
            Log.i(LOGTAG, "vertical padding is " + verticalPadding);
            verticalPadding = 0;
        } else {
            // Place 4/5 of padding at top, and 1/5 of padding at bottom.
            topPadding = (verticalPadding*4)/5;
            bottomPadding = verticalPadding/5;
        }

        if (sidePadding < 0) {
            Log.i(LOGTAG, "side padding is " + sidePadding);
            leftPadding = 0;
            rightPadding = 0;
        } else {
            // Divide the padding equally on the left and right side.
            leftPadding = sidePadding/2;
            rightPadding = leftPadding;
        }

        // Create a padding-box around the image and let Android fill the box with
        // the image. Android will scale the width and height independently, so the
        // end result should be a correctly-sized graphic.
        onionImg.setPadding(leftPadding, topPadding, rightPadding, bottomPadding);

        // Separately scale x- and y-dimension.
        onionImg.setScaleType(ImageView.ScaleType.FIT_XY);

        // Invalidate the view because the image disappears (is not redrawn) sometimes when
        // the screen is rotated.
        onionImg.invalidate();
    }

    private class ViewTreeLayoutListener implements ViewTreeObserver.OnGlobalLayoutListener {
        @Override
        public void onGlobalLayout() {
            TorBootstrapPanel.this.setOnionImgLayout();
        }
    }

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container, Bundle savedInstance) {
        mRoot = (ViewGroup) inflater.inflate(R.layout.tor_bootstrap, container, false);
        if (mRoot == null) {
            Log.w(LOGTAG, "Inflating R.layout.tor_bootstrap returned null");
            return null;
        }

        Button connectButton = mRoot.findViewById(R.id.tor_bootstrap_connect);
        if (connectButton == null) {
            Log.w(LOGTAG, "Finding the Connect button failed. Did the ID change?");
            return null;
        }

        connectButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startBootstrapping();
            }
        });

        if (Build.VERSION.SDK_INT > 20) {
            // Round the button's edges, but only on API 21+. Earlier versions
            // do not support this.
            //
            // This should be declared in the xml layout, however there is a bug
            // preventing this (the XML attribute isn't actually defined in the
            // SDK).
            // https://issuetracker.google.com/issues/37036728
            connectButton.setClipToOutline(true);
        }

        configureGearCogClickHandler();

        TorLogEventListener.addLogger(this);

        // Add a callback for notification when the layout is complete and all components
        // are measured. Waiting until the layout is complete is necessary before we correctly
        // set the size of the onion. Cache the listener so we may remove it later.
        mViewTreeLayoutListener = new ViewTreeLayoutListener();
        mRoot.getViewTreeObserver().addOnGlobalLayoutListener(mViewTreeLayoutListener);

        return mRoot;
    }

    @Override
    public void onDestroyView() {
        // Inform the background AlphaChanging thread it should terminate.
        synchronized(mOnionAlphaChangerLock) {
            mOnionAlphaChangerRunning = false;
        }

        super.onDestroyView();
    }

    private void setOnionAlphaValue(int newAlpha) {
        ImageView onionImg = (ImageView) mRoot.findViewById(R.id.tor_bootstrap_onion);
        if (onionImg == null) {
            return;
        }

        if (newAlpha > 255) {
            // Cap this at 255 and change direction of animation
            newAlpha = 255;

            synchronized(mOnionAlphaChangerLock) {
                mOnionCurrentAlphaDirection = -1;
            }
        } else if (newAlpha < 0) {
            // Lower-bound this at 0 and change direction of animation
            newAlpha = 0;

            synchronized(mOnionAlphaChangerLock) {
                mOnionCurrentAlphaDirection = 1;
            }
        }
        onionImg.setImageAlpha(newAlpha);
        mOnionCurrentAlpha = newAlpha;
    }

    public void updateStatus(String torServiceMsg, String newTorStatus) {
        final String noticePrefix = "NOTICE: ";

        if (torServiceMsg == null) {
            return;
        }

        TextView torLog = (TextView) mRoot.findViewById(R.id.tor_bootstrap_last_status_message);
        if (torLog == null) {
            Log.w(LOGTAG, "updateStatus: torLog is null?");
        }
        // Only show Notice-level log messages on this panel
        if (torServiceMsg.startsWith(noticePrefix)) {
            // Drop the prefix
            String msg = torServiceMsg.substring(noticePrefix.length());
            torLog.setText(msg);
        } else if (torServiceMsg.toLowerCase().contains("error")) {
            torLog.setText(R.string.tor_notify_user_about_error);

            // This may be a false-positive, but if we encountered an error within
            // the OrbotService then there's likely nothing the user can do. This
            // isn't persistent, so if they restart the app the button will be
            // visible again.
            Button connectButton = mRoot.findViewById(R.id.tor_bootstrap_connect);
            if (connectButton == null) {
                Log.w(LOGTAG, "updateStatus: Finding the Connect button failed. Did the ID change?");
            } else {
                TextView swipeLeftLog = (TextView) mRoot.findViewById(R.id.tor_bootstrap_swipe_log);
                if (swipeLeftLog == null) {
                    Log.w(LOGTAG, "updateStatus: swipeLeftLog is null?");
                }

                // Abuse this by showing the log message despite not bootstrapping
                toggleVisibleElements(true, torLog, connectButton, swipeLeftLog);
            }
        }

        // Return to the browser when we reach 100% bootstrapped
        if (torServiceMsg.contains(TorServiceConstants.TOR_CONTROL_PORT_MSG_BOOTSTRAP_DONE)) {
            // Inform the background AlphaChanging thread it should terminate
            synchronized(mOnionAlphaChangerLock) {
                mOnionAlphaChangerRunning = false;
            }
            close();

            // Remove the listener when we're done
            mRoot.getViewTreeObserver().removeOnGlobalLayoutListener(mViewTreeLayoutListener);
        }
    }

    public void setContext(Activity ctx) {
        mActContext = ctx;
    }

    // Save the TorBootstrapController.
    // This method won't be used by the main TorBootstrapPanel (|this|), but
    // it will be used by its childen.
    public void setBootstrapController(TorBootstrapPager.TorBootstrapController bootstrapController) {
        mBootstrapController = bootstrapController;
    }

    private void startTorService() {
        Intent torService = new Intent(getActivity(), TorService.class);
        torService.setAction(TorServiceConstants.ACTION_START);
        getActivity().startService(torService);
    }

    private void stopTorService() {
        // First, stop the current bootstrapping process (if it's in progress)
        // TODO Ideally, we'd DisableNetwork here, but that's not available.
        Intent torService = new Intent(getActivity(), TorService.class);
        getActivity().stopService(torService);
    }

    // Setup OnClick handler for the settings gear/cog
    protected void configureGearCogClickHandler() {
        if (mRoot == null) {
            Log.w(LOGTAG, "configureGearCogClickHandler: mRoot is null?");
            return;
        }

        final ImageView gearSettingsImage = mRoot.findViewById(R.id.tor_bootstrap_settings_gear);
        if (gearSettingsImage == null) {
            Log.w(LOGTAG, "configureGearCogClickHandler: gearSettingsImage is null?");
            return;
        }

        gearSettingsImage.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                // The existance of the connect button is an indicator of the user
                // interacting with the main bootstrapping screen or the loggin screen.
                Button connectButton = mRoot.findViewById(R.id.tor_bootstrap_connect);
                if (connectButton == null) {
                    Log.w(LOGTAG, "gearSettingsImage onClick: Finding the Connect button failed, proxying request.");

                    // If there isn't a connect button on this screen, then proxy the
                    // stopBootstrapping() request via the TorBootstrapController (which
                    // is the underlying PagerAdapter).
                    mBootstrapController.stopBootstrapping();
                } else {
                    stopBootstrapping();
                }
                // Open Tor Network Settings preferences screen
                Intent intent = new Intent(mActContext, TorPreferences.class);
                mActContext.startActivity(intent);
            }
        });
    }

    private void toggleVisibleElements(boolean bootstrapping, TextView lastStatus, Button connect, TextView swipeLeft) {
        final int connectVisible = bootstrapping ? View.INVISIBLE : View.VISIBLE;
        final int infoTextVisible = bootstrapping ? View.VISIBLE : View.INVISIBLE;

        if (connect != null) {
            connect.setVisibility(connectVisible);
        }
        if (lastStatus != null) {
            lastStatus.setVisibility(infoTextVisible);
        }
        if (swipeLeft != null) {
            swipeLeft.setVisibility(infoTextVisible);
        }
    }

    private void startBackgroundAlphaChangingThread() {
        // If it is non-null, then this is a bug because the thread should null this reference when
        // it terminates.
        if (mChangeOnionAlphaThread != null) {
            if (mChangeOnionAlphaThread.getState() == Thread.State.TERMINATED) {
                // The thread likely terminated unexpectedly, null the reference.
                // The thread should set this itself.
                Log.i(LOGTAG, "mChangeOnionAlphaThread.getState(): is terminated");
                mChangeOnionAlphaThread = null;
            } else {
                // The reference is not nulled in this case because another
                // background thread would start otherwise. The thread is currently in
                // an unknown state, simply set the Running flag as false.
                Log.w(LOGTAG, "We're in an unexpected state. mChangeOnionAlphaThread.getState(): " + mChangeOnionAlphaThread.getState());

                synchronized(mOnionAlphaChangerLock) {
                    mOnionAlphaChangerRunning = false;
                }
            }
        }

        // If the background thread is not currently running, then start it.
        if (mChangeOnionAlphaThread == null) {
            mChangeOnionAlphaThread = new Thread(new ChangeOnionAlphaRunnable());
            if (mChangeOnionAlphaThread == null) {
                Log.w(LOGTAG, "Instantiating a new ChangeOnionAlphaRunnable Thread failed.");
            } else if (mChangeOnionAlphaThread.getState() == Thread.State.NEW) {
                Log.i(LOGTAG, "Starting mChangeOnionAlphaThread");

                // Synchronization across threads should not be necessary because there
                // shouldn't be any other threads relying on mOnionAlphaChangerRunning.
                // Do this purely for safety.
                synchronized(mOnionAlphaChangerLock) {
                    mOnionAlphaChangerRunning = true;
                }

                mChangeOnionAlphaThread.start();
            }
        }
    }

    public void startBootstrapping() {
        if (mRoot == null) {
            Log.w(LOGTAG, "startBootstrapping: mRoot is null?");
            return;
        }
        // Start bootstrap process and transition into the bootstrapping-tor-panel
        Button connectButton = mRoot.findViewById(R.id.tor_bootstrap_connect);
        if (connectButton == null) {
            Log.w(LOGTAG, "startBootstrapping: connectButton is null?");
            return;
        }

        ImageView onionImg = (ImageView) mRoot.findViewById(R.id.tor_bootstrap_onion);

        Drawable drawableOnion = onionImg.getDrawable();

        mOnionCurrentAlpha = 255;
        // The onion should have 100% alpha, begin decreasing it.
        mOnionCurrentAlphaDirection = -1;
        startBackgroundAlphaChangingThread();

        TextView torStatus = (TextView) mRoot.findViewById(R.id.tor_bootstrap_last_status_message);
        if (torStatus == null) {
            Log.w(LOGTAG, "startBootstrapping: torStatus is null?");
            return;
        }

        TextView swipeLeftLog = (TextView) mRoot.findViewById(R.id.tor_bootstrap_swipe_log);
        if (swipeLeftLog == null) {
            Log.w(LOGTAG, "startBootstrapping: swipeLeftLog is null?");
            return;
        }

        torStatus.setText(getString(R.string.tor_bootstrap_starting_status));

        toggleVisibleElements(true, torStatus, connectButton, swipeLeftLog);
        startTorService();
    }

    // This is public because this Pager may call this method if another Panel requests it.
    public void stopBootstrapping() {
        if (mRoot == null) {
            Log.w(LOGTAG, "stopBootstrapping: mRoot is null?");
            return;
        }
        // Transition from the animated bootstrapping panel to
        // the static "Connect" panel
        Button connectButton = mRoot.findViewById(R.id.tor_bootstrap_connect);
        if (connectButton == null) {
            Log.w(LOGTAG, "stopBootstrapping: connectButton is null?");
            return;
        }

        ImageView onionImg = (ImageView) mRoot.findViewById(R.id.tor_bootstrap_onion);
        if (onionImg == null) {
            Log.w(LOGTAG, "stopBootstrapping: onionImg is null?");
            return;
        }

        // Inform the background AlphaChanging thread it should terminate.
        synchronized(mOnionAlphaChangerLock) {
            mOnionAlphaChangerRunning = false;
        }

        Drawable drawableOnion = onionImg.getDrawable();

        // Reset the onion's alpha value.
        onionImg.setImageAlpha(255);

        TextView torStatus = (TextView) mRoot.findViewById(R.id.tor_bootstrap_last_status_message);
        if (torStatus == null) {
            Log.w(LOGTAG, "stopBootstrapping: torStatus is null?");
            return;
        }

        TextView swipeLeftLog = (TextView) mRoot.findViewById(R.id.tor_bootstrap_swipe_log);
        if (swipeLeftLog == null) {
            Log.w(LOGTAG, "stopBootstrapping: swipeLeftLog is null?");
            return;
        }

        // Reset the displayed message
        torStatus.setText("");

        toggleVisibleElements(false, torStatus, connectButton, swipeLeftLog);
        stopTorService();
    }
}
