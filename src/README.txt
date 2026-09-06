Fade Tools for Lyrion Music Server
===================================

Version 1.0.4

CLI commands
------------

Fade out and then pause:

    <playerid> fadeout pause <seconds>

Fade out and then stop:

    <playerid> fadeout stop <seconds>

Fade in while starting/resuming playback:

    <playerid> fadein play <seconds>

Fade in while resuming a paused player:

    <playerid> fadein resume <seconds>

Convenience alias:

    <playerid> fadein pause <seconds>

"fadein pause" is identical to "fadein resume".

Examples
--------

    00:11:22:33:44:55 fadeout pause 2
    00:11:22:33:44:55 fadeout stop 3
    00:11:22:33:44:55 fadein play 2
    00:11:22:33:44:55 fadein resume 1

Durations must be > 0 and <= 60 seconds.

Implementation
--------------

Fade-out uses LMS Player::fade_volume() with a negative duration. Timing and
gain updates therefore happen internally inside LMS.

Fade-in uses LMS's native fade-in support:
    play <fadeInSecs>
    pause 0 <fadeInSecs>

This allows LMS to start the fade when playback actually reaches PLAYING,
rather than relying on external timing.

Sync groups
-----------

Fade-out is applied to all active members of the sync group in parallel.
Pause/stop is issued after all fade callbacks have completed.

Upgrade from the old FadeOut plugin
-----------------------------------

Do not load the old FadeOut plugin and Fade Tools at the same time because
both register the same "fadeout pause" and "fadeout stop" commands.

For the official Lyrion Docker image:

    rm -rf /config/cache/Plugins/FadeOut

Install Fade Tools here:

    /config/cache/Plugins/FadeTools/

Expected files:

    /config/cache/Plugins/FadeTools/Plugin.pm
    /config/cache/Plugins/FadeTools/install.xml
    /config/cache/Plugins/FadeTools/strings.txt
    /config/cache/Plugins/FadeTools/README.txt

Then restart the LMS container.

Logging category
----------------

    plugin.fadetools
