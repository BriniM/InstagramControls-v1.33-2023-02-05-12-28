'use strict';
function InstagramVideoControls() {
    let moveReactionBarIntervalHandle = null;
    let stylesSet = false;

    let showLog = false;

    /** @var {HTMLVideoElement} */
    let player;

    let config = {};

    // true after .init() was called.
    let initialized = false;

    const knownVideoElements = new Set();

    /**
     * @param {Node?} contextNode
     * @return {HTMLVideoElement[]}
     */
    function getVideos(contextNode = undefined) {
        return util.queryAll("video", contextNode);
    }

    function now() {
        return new Date().getTime();
    }

    function modifyVideo(video) {
        if (videoControlsAlreadyInitialized(video)) {
            return;
        }

        // Try to find a component root element, which is basically a div that's a few parents above the video element,
        // and serves as a container for all the instagram GUI stuff, like buttons, images, overlays, the video element etc...

        // .EmbedVideo is found when were in an iframe used by a 3rd party to embed instagram.
        let componentRoot = video.closest(".EmbedVideo");
        console.log(componentRoot)
        if (!componentRoot) {
            // Try to find the style of root used on instagram.com when they overlay the video with a big play button.
            componentRoot = util.recordEx('gevcre', getEstimatedVideoComponentRootElement)(video);
        }

        if (!componentRoot) {
            // If we reached here, either they changed their dom structure, or its a video without the insta-junk markup. This seems to happen
            // on very long videos - they just present a native html5 player, although they still disable downloads and other stuff.
            // We'll just go up 4 parents like the other cases and hope for the best lol.
            // I think we aren't likely to find any overlay buttons in this case, at least I havent encountered any yet.
            // this should probably be the 5th parent instead of 4th, to be consistent /w our other code, but 4th works, and is safer.
            componentRoot = nthParent(video, 4);
        }

        if (componentRoot) {
            util.recordEx('mve', modifyVideoElement)(componentRoot);
            util.recordEx('mowipc', modifyOverlayWithInstagramPlayControl)(componentRoot, video);
        }
    }

    function modifyVideoElementsControls(rootElement, video) {
        /*
        force element with class 
        "x12svp7l x1ey2m1c x9f619 x78zum5 xdt5ytf x18dl8mb xtijo5x x1o0tod x13a6bvl x1l90r2v xv54qhq xf7dkkf x47corl x10l6tqk" 
        to use flex-start  as their justify-content property.
        */
       console.log("modifyVideoElementsControls got called");
       if (moveReactionBarIntervalHandle && stylesSet) {
                clearInterval(moveReactionBarIntervalHandle);
                moveReactionBarIntervalHandle = null;
            }
    
        var elements = document.querySelectorAll('.x12svp7l.x1ey2m1c.x9f619.x78zum5.xdt5ytf.x18dl8mb.xtijo5x.x1o0tod.x13a6bvl.x1l90r2v.xv54qhq.xf7dkkf.x47corl.x10l6tqk');
        if (elements.length > 0) {
            elements[0].style.justifyContent = 'flex-start'
            stylesSet = true;
        }
    }

    function modifyAllPresentVideos() {
        getVideos().forEach(modifyVideo);
    }

    function hide(el) {
        // Being visibility:hidden also prevents mouse events.
        // Also, a hidden element retains its size as determined by the bounding box.
        // Both of these factors matter, and other code depends on them being that way.
        el && el.style && (el.style.visibility = 'hidden');
    }

    /**
     * This element is their control which pauses the vid when you hold the mouse down.
     * It interferes with the <video> receiving mousemove events necessary to show the native controls,
     * and also interferes w/ normal click to toggle play/pause.
     *
     * Unfortunately, there's some sub elements that look like they may have functionality,
     * and by hiding their root, we might be breaking features. There's a
     *      role=dialog
     * and also a
     *      aria-label="Cancel Popup" role=button
     *
     * todo need to investigate more. a child of the Cancel Popup div had a name and clickable link to a users
     * instagram page on one video.
     * @param videoElement
     */
    function incapacitateStoryVideoPausingOverlays(videoElement) {
        // There's more than 1 element overlaying the video. Hide all the siblings.
        // Also, they change this markup often.
        Array.from(videoElement.parentElement.children).filter(el => el !== videoElement).forEach(hide);
    }

    function modifyVideoElement(embedRootElem) {

        getVideos(embedRootElem).forEach(videoPlayer => {

            if (videoControlsAlreadyInitialized(videoPlayer)) {
                // Skip, we've already processed this element.
                return;
            }

            // This is used as a css selector to redefine the style instatard uses to hide the native media controls.
            // We use the dataset instead of a class because the react framework that they use will overwrite some other properties, erasing our class name.
            videoPlayer.dataset.nativeControlsISetJooFree = "1";
            knownVideoElements.add(videoPlayer);

            // Enable native controls. Some instagram videos actually already have them enabled.
            videoPlayer.controls = true;

            // They tend to not show the download video option, so we reenable it by clearing the list of restricted controls.
            // But often this results in a failed download if the user clicks the button.
            videoPlayer.setAttribute('controlsList', '');

            if (isInstagramStoriesPage()) {
                incapacitateStoryVideoPausingOverlays(videoPlayer);
            }

            // Keep html5 mute and instagram mute buttons in sync.
            // Start by finding the instagram mute button.
            const buttons = findVolumeOrTagsButtons(embedRootElem, videoPlayer);
            if (buttons.audioButton) {
                // Get instagram custom GUI mute button.
                // Note the svg element gets replaced in the dom, so don't cache a ref to it.
                const muteButton = buttons.audioButton;
                const isMuted = () => {
                    const svg = muteButton.querySelector('svg');
                    if (!svg) {
                        return undefined;
                    }

                    // Start with check for lang=english.
                    const ariaLabel = svg.getAttribute('aria-label');
                    if (ariaLabel && ariaLabel.length && ariaLabel.toLowerCase().includes('audio')) {
                        return ariaLabel.toLowerCase().includes('muted');
                    }

                    // fallback for other langs.
                    // We look at the icon.
                    const svgStrokePath = 'M1.5 13.3c-.8 0-1.5.7-1.5 1.5v18.4c0 .8.7 1.5 1.5 1.5h8.7l12.9 12.9c.9.9 2.5.3 2.5-1v-9.8c0-.4-.2-.8-.4-1.1l-22-22c-.3-.3-.7-.4-1.1-.4h-.6zm46.8 31.4-5.5-5.5C44.9 36.6 48 31.4 48 24c0-11.4-7.2-17.4-7.2-17.4-.6-.6-1.6-.6-2.2 0L37.2 8c-.6.6-.6 1.6 0 2.2 0 0 5.7 5 5.7 13.8 0 5.4-2.1 9.3-3.8 11.6L35.5 32c1.1-1.7 2.3-4.4 2.3-8 0-6.8-4.1-10.3-4.1-10.3-.6-.6-1.6-.6-2.2 0l-1.4 1.4c-.6.6-.6 1.6 0 2.2 0 0 2.6 2 2.6 6.7 0 1.8-.4 3.2-.9 4.3L25.5 22V1.4c0-1.3-1.6-1.9-2.5-1L13.5 10 3.3-.3c-.6-.6-1.5-.6-2.1 0L-.2 1.1c-.6.6-.6 1.5 0 2.1L4 7.6l26.8 26.8 13.9 13.9c.6.6 1.5.6 2.1 0l1.4-1.4c.7-.6.7-1.6.1-2.2z';
                    try {
                        return svg.querySelector('path').getAttribute('d').toLowerCase().includes(svgStrokePath.toLowerCase());
                    } catch (ex) {
                        // the svg viewBox="0 0 48 48" for muted
                        // the svg viewBox="0 0 24 24" for playing
                        const viewBox = svg.getAttribute('viewBox');
                        if (viewBox) {
                            return viewBox === '0 0 48 48';
                        }
                        return undefined;
                    }
                };

                // Disable mute button sync for now since its misbehaving.
                // @todo fix it.
                // We have an event handler for the timechange event, and from within that event handler, we click
                // a button which can cause the event to happen again. It shouldn't make a loop, but the possibility exists,
                // and so as a defensive measure we make sure this click doesn't happen more often than
                // x per N seconds. This little FloodTracker class helps us keep track of how many times something has
                // occurred in some recent time slice.
                // const floodTracker = new util.FloodTracker(5, 10);
                // // Note: volumechange fires on both volume or mute change.
                // videoPlayer.addEventListener('volumechange', evt => {
                //     window.videoPlayer=videoPlayer;
                //     const guiIsMuted = isMuted();
                //     const volume = videoPlayer.volume;
                //     const muted = videoPlayer.muted;
                //     log('volumechange', {volume, muted, guiIsMuted, videoPlayer, evt});
                //     var abort=0;
                //     if (abort === 1) {}
                //     if (abort) {
                //         return;
                //     }
                //
                //     if (!floodTracker.limitExceeded()) {
                //         if (guiIsMuted !== undefined && videoPlayer.muted !== guiIsMuted) {
                //             // By clicking the GUI button, it should put them back in sync.
                //             log('muteButton.click()', {muteButton, videoPlayer, guiIsMuted, muted: videoPlayer.muted, volume: videoPlayer.volume, evt});
                //             floodTracker.markEventOccurred();
                //             muteButton.click();
                //         }
                //     } else {
                //         log('floodTracker limit exceeded');
                //     }
                // });
            }

            // We debounce this event handler because it can fire rapidly when dragging the volume slider, and it can sometimes create
            // a complicated feedback loop involving this handler and I think either the storage change event, or maybe just
            // queued up events, which causes the volume to skip around as you drag it due to the backlog of events.
            // Normally the "config.volumeLevel !== videoPlayer.volume" condition prevents feedback loops, but when there's
            // a backlog I think it can screw up.
            // Note: volumechange fires on both volume or mute change.
            videoPlayer.addEventListener('volumechange', util.debounce(evt => {
                if (config.rememberVolumeLevel && config.volumeLevel !== videoPlayer.volume) {
                    const vVol = videoPlayer.volume;
                    const cVol = config.volumeLevel;
                    saveVolumeLevel(videoPlayer.volume);
                    // We dont need to call setVolumeOfPreviouslySeenVideoElements to update the other players right this
                    // instant because they will get updated by the storage change event from saving the volume. but,
                    // by updating their volume now, each videos volumechange event handler will only fire once,
                    // and it will fail the if statement, resulting in efficiency. If we let the storage change event update them
                    // then it ???????????????????????
                    log(`The volume changed. cVol=${cVol} vVol=${vVol}`, evt);
                    setVolumeOfPreviouslySeenVideoElements(videoPlayer.volume);
                }
            }, 200));

            videoPlayer.addEventListener('ratechange', util.debounce(evt => {
                if (config.rememberPlaybackRate && config.playbackRate !== videoPlayer.playbackRate) {
                    savePlaybackRate(videoPlayer.playbackRate);
                    setPlaybackRateOfPreviouslySeenVideoElements(videoPlayer.playbackRate);
                    log('The playbackRate changed.', evt, videoPlayer.playbackRate);
                }
            }, 200));

            // We set the volume immediately because this is the first time we've seen this element.
            if (config.rememberVolumeLevel) {
                setVolumeIfChanged(videoPlayer, config.volumeLevel);
            }
            if (config.rememberPlaybackRate) {
                setPlaybackRateIfChanged(videoPlayer, config.playbackRate);
            }

            // We probably only need to add css to the page once, but im worried react might remove it in some obscure
            // case, so adding it over and over seems safer.
            redefineWebkitMediaControlHidingCssRule();

            try {
                // This func has a high chance of failing w/ NPE if instagram changes their dom layout.
                // It's not critical for this function to succeed, so we just keep going if it throws.
                // We only want to modify videos on stories.
                if (isInstagramStoriesPage()) {
                    // We call the func multiple times because on stories, if we transition from watching a story video
                    // to another story video, there's a brief moment where the transition animation runs that we have
                    // two video elements in the dom, and the new video starts off tiny as it animates in.
                    // If our func runs during this time, the sizing gets screwed up because it measures a tiny video.
                    // So, we just run it a few times, hoping that their browser will be fast enough to render it full size within 1.5 seconds.
                    modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls(videoPlayer);
                    setTimeout(() => modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls(videoPlayer), 300);
                    setTimeout(() => modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls(videoPlayer), 600);
                    setTimeout(() => modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls(videoPlayer), 1500);
                }
            } catch (ex) {
                log(ex);
            }
        });
    }

    function videoControlsAlreadyInitialized(videoPlayer) {
        return !!videoPlayer.dataset.nativeControlsISetJooFree;
    }

    function setPlaybackRateIfChanged(player, newPlaybackRate) {
        // Only update if the current playbackRate is different from the new playbackRate (avoids triggering a new ratechange event).
        if (player && !isNaN(newPlaybackRate) && valuesAreDifferentEnough(player.playbackRate,  newPlaybackRate)) {
            try {
                player.playbackRate = newPlaybackRate;
            } catch (ex) {
                log('failed to set playback rate. it was probably out of range.', {player, playbackRate: newPlaybackRate, ex});
            }
        }
    }

    function setVolumeIfChanged(player, newVolume) {
        // Only update if the current volume is different from the new volume (avoids triggering a new volumechange event).
        const currentVolume = player.volume;
        if (player && !isNaN(newVolume) && valuesAreDifferentEnough(currentVolume,  newVolume)) {
            try {
                //log('before set vol');
                player.volume = newVolume;
                log(`setVolumeIfChanged old=${currentVolume} new=${newVolume}`, new Date().toISOString());
                // If you notice sometimes videos autoplay but start muted, it's likely this Chrome feature: https://developers.google.com/web/updates/2017/09/autoplay-policy-changes
            } catch (ex) {
                log('failed to set volume. it was probably out of range.', {player, volume: newVolume, ex});
            }
        }
    }

    function setVolumeOfPreviouslySeenVideoElements(volume) {
        getKnownVideoElements().forEach(video => {
            setVolumeIfChanged(video, volume);
        });
    }

    function setPlaybackRateOfPreviouslySeenVideoElements(playbackRate) {
        getKnownVideoElements().forEach(video => {
            setPlaybackRateIfChanged(video, playbackRate);
        });
    }

    /**
     *
     * @param {number} floatVal1
     * @param {number} floatVal2
     * @param {number} [minimumDiff]
     */
    function valuesAreDifferentEnough(floatVal1, floatVal2, minimumDiff = 0.01) {
        return Math.abs(floatVal1 > floatVal2 ? floatVal1 - floatVal2 : floatVal2 - floatVal1) >= minimumDiff;
    }

    function getKnownVideoElements() {
        // First, we loop over them to remove any no longer in the dom.
        // for (const v of knownVideoElements) {
        //     if (!document.body.contains(v)) {
        //         knownVideoElements.delete(v);
        //     }
        // }
        // Now we can return the set.
        return knownVideoElements;
    }

    function saveVolumeLevel(volumeLevel) {
        saveUserConfig({volumeLevel});
    }

    function savePlaybackRate(playbackRate) {
        saveUserConfig({playbackRate});
    }

    /**
     * They set "display: none" to hide the native controls, so we redefine their oppressive style.
     * Some pages require a high specificity selector, so we add [controls] for no other reason
     * than to increase specificity.
     */
    function redefineWebkitMediaControlHidingCssRule() {
        const id = "native-controls-i-set-joo-free";
        const css = `video[data-${id}][controls]::-webkit-media-controls { display: flex; }`;

        // Prevent from adding css multiple times per page, while re-adding it if it disappears.
        if (!document.getElementById(id)) {
            addCss(css, id);
        }
    }

    function addCss(cssCode, id) {
        const styleElement = document.createElement("style");
        id && styleElement.setAttribute("id", id);
        styleElement.appendChild(document.createTextNode(cssCode));
        document.getElementsByTagName("head")[0].appendChild(styleElement);
    }

    /**
     * The buttons array is more likely to be present and filled. The audioButton and tagsButton
     * are more likely to break in the future.
     *
     * @returns {{audioButton: Node, buttons: Node[], tagsButton: Node}}
     */
    function findVolumeOrTagsButtons(embedRootElem, video) {
        const videoRect = video.getBoundingClientRect();

        function locatedInBottomThirdOfVideoRect(el) {
            const elRect = el.getBoundingClientRect();
            // Check if button is in bottom 1/3 of video.
            return elRect.bottom <= videoRect.bottom && elRect.top >= videoRect.bottom - (videoRect.height / 3);
        }

        function hasApproximateSizeOfSmallButton(el) {
            const elRect = el.getBoundingClientRect();
            return elRect.width >= 10 && elRect.width <= 60 && elRect.height >= 10 && elRect.height <= 60;
        }

        function matchesAriaLabel(elem, text) {
            const ariaLabel = elem.getAttribute('aria-label');
            return (ariaLabel || '').toLowerCase().includes(text);
        }

        function svgStrokePathMatches(button, svgStrokePath) {
            const path = button.querySelector('path');
            if (!path) {
                return false;
            }
            // Hopefully they don't change their icons too often, causing this to fail.
            const d = path.getAttribute('d');
            return d && d.toLowerCase().includes(svgStrokePath.toLowerCase());
        }

        function looksLikeAudioButton(button) {
            // This check only likely to work for lang=english.
            if (matchesAriaLabel(button, 'audio')) {
                return true;
            }

            // M1.5 13.3c-.8 0-1.5.7-1.5 1.5v18.4c0 .8.7 1.5 1.5 1.5h8.7l12.9 12.9c.9.9 2.5.3 2.5-1v-9.8c0-.4-.2-.8-.4-1.1l-22-22c-.3-.3-.7-.4-1.1-.4h-.6zm46.8 31.4-5.5-5.5C44.9 36.6 48 31.4 48 24c0-11.4-7.2-17.4-7.2-17.4-.6-.6-1.6-.6-2.2 0L37.2 8c-.6.6-.6 1.6 0 2.2 0 0 5.7 5 5.7 13.8 0 5.4-2.1 9.3-3.8 11.6L35.5 32c1.1-1.7 2.3-4.4 2.3-8 0-6.8-4.1-10.3-4.1-10.3-.6-.6-1.6-.6-2.2 0l-1.4 1.4c-.6.6-.6 1.6 0 2.2 0 0 2.6 2 2.6 6.7 0 1.8-.4 3.2-.9 4.3L25.5 22V1.4c0-1.3-1.6-1.9-2.5-1L13.5 10 3.3-.3c-.6-.6-1.5-.6-2.1 0L-.2 1.1c-.6.6-.6 1.5 0 2.1L4 7.6l26.8 26.8 13.9 13.9c.6.6 1.5.6 2.1 0l1.4-1.4c.7-.6.7-1.6.1-2.2z
            return svgStrokePathMatches(button, 'M1.5 13.3c-.8 0-1.5.7-1.5 1.5v18.4c0');
        }

        function looksLikeTagsButton(button) {
            // This check only likely to work for lang=english.
            const svg = button.querySelector('svg');
            if (svg && matchesAriaLabel(svg, 'tags')) {
                return true;
            }

            // We fall back to comparing part of the svg path.
            // M21.334 23H2.666a1 1 0 0 1-1-1v-1.354a6.279 6.279 0 0 1 6.272-6.272h8.124a6.279 6.279 0 0 1 6.271 6.271V22a1 1 0 0 1-1 1ZM12 13.269a6 6 0 1 1 6-6 6.007 6.007 0 0 1-6 6Z
            return svgStrokePathMatches(button, 'M21.334 23H2.666a1 1 0 0 1-1-1v-1.354a6.279 6.279');
        }

        // On stories, the audio button is in a different location, so we try to
        // reorient. Also, there's no tags button.
        let buttons;
        if (isInstagramStoriesPage()) {
            const section = embedRootElem.closest('section');
            if (section) {
                const header = section.querySelector('header');
                if (header) {
                    embedRootElem = header;
                }
            }
            buttons = util.queryAll("button:has(svg)", embedRootElem)
                .filter(hasApproximateSizeOfSmallButton);
        } else {
            buttons = util.queryAll("button:has(svg)", embedRootElem)
                .filter(locatedInBottomThirdOfVideoRect)
                .filter(hasApproximateSizeOfSmallButton);
        }

        
        const audioButton = buttons.filter(looksLikeAudioButton)[0];
        const tagsButton = buttons.filter(looksLikeTagsButton)[0];
        return {buttons, audioButton, tagsButton};
    }

    function modifyOverlayWithInstagramPlayControl(embedRootElem, video) {
        // Hide the clear overlay that prevents click events from reaching the actual video element + controls.
        util.queryAll(".videoSpritePlayButton", embedRootElem).map(el => el.parentNode).forEach(hide);

        // Some more clear overlays may be hidden by this.
        // getVideoCoveringButtons(embedRootElem).forEach(hide);

        function findPlayButton(embedRootElem, video) {
            // If browser lang = english, this is easy by looking for the aria-label.
            const playButton = util.query("[role=button][aria-label=Play]", embedRootElem);
            if (playButton) {
                return playButton;
            }
            // Otherwise we need to look at dimensions + attributes.
            return util.queryAll("[role=button][aria-label]", embedRootElem).filter(el => {
                const rect = el.getBoundingClientRect();
                const parentRect = el.parentElement.getBoundingClientRect();
                // todo, check if rect centered in parent?
                // Check if elem is big, but not the entire size of its parent - well say less than 80% of parent dimensions.
                if (rect.width >= 80 && rect.height >= 80 && rect.width < parentRect.width * 0.8 && rect.height < parentRect.height * 0.8) {
                    // Now check if parent covers video
                    return looksLikeCoversVideo(el.parentElement, video);
                }
            })[0];
        }

        function findControlButton(embedRootElem, video) {
            // If browser lang = english, this is easy by looking for the aria-label.
            const controlButton = util.query("[role=button][aria-label=Control]", embedRootElem);
            if (controlButton) {
                return controlButton;
            }
            // Otherwise we need to look at dimensions + attributes.
            return getVideoCoveringButtons(embedRootElem, video)[0];
        }

        // Now, the main big play button in the middle/center of the video has a parent that has the same size
        // as the video itself. We want to keep this because the instagram code has click listeners on it, and they
        // use it to toggle play pause state and that's important so that videos auto play or stay paused properly
        // when scrolling on the home page. But, the overlay covers the html5 controls, so we need to resize the
        // overlay upwards so it doesnt cover the bottom of the video where the controls are.
        // 70px should be just enough. If we do too much, like 300px, then the play button wont be vertically centered.
        // Also, we want the user to click the overlay when toggling play pause, and not the video itself, so instagram code
        // properly manages play/pause state. If we raise the overlay too much, we increase the area where they could click
        // the video.
        // TODO measure this instead of assuming 70px is correct. Maybe measure from the top of the mute or like button,
        // and use the value so long as it seems reasonable and abut where we expect it to be located?
        const heightOfHtml5Controls = '70px';
        const playButton = findPlayButton(embedRootElem, video);
        if (playButton) {
            // The default styles should be set to top: 0; bottom: 0; but they could also be top: 0px etc..
            playButton.parentElement.style.bottom = heightOfHtml5Controls;
        }

        const controlButton = findControlButton(embedRootElem, video);
        if (controlButton) {
            // On some pages (so far just on /reels/ urls) we end up adding a 70px spacing twice, which is too much.
            // So we try to avoid this specific case.
            if (!controlButton.closest('[data-instancekey]') && !controlButton.matches('[data-visualcompletion]')) {
                controlButton.style.bottom = heightOfHtml5Controls;
            }
        }

        // Nov 2022
        // Some users are getting a new version of the GUI.
        // Old/current style
        // <div>
        // 	<div>
        // 		<div>
        // 			<div>
        // 				<video/>
        // 			</div>
        // 		</div>
        // 	</div>
        // 	<div><span aria-label=Play></span></div>
        // 	<div aria-label=Control></div>
        // 	<div><button>audio</button> </div>
        // 	<div><button>tags</button> </div>
        // </div>
        //
        //
        // New style. probably started for some users mid nov 2022.
        // It also seems the new reels feature uses this new style even when the rest of the GUI/pages uses the old style.
        // <div>
        // 	<div>
        // 		<div>
        // 			<div>
        // 				<video/>
        // 				<div data-instancekey>
        // 					<div data-visualcompletion>
        //                      <!-- Note, there can be another element layer here wrapping the role=presentation. -->
        //                      <!-- Also, sometimes the role=presentation element doesn't exist, but this occurs on pages we dont want to modify anyway. -->
        // 						<div role="presentation">
        // 							<div>
        // 								<div></div>
        // 							</div>
        // 						</div>
        // 						<div>
        // 							<button>audio</button>
        // 						</div>
        // 						<div>
        // 							<button>tags</button>
        // 						</div>
        // 					</div>
        // 				</div>
        // 			</div>
        // 		</div>
        // 	</div>
        // </div>

        // I cant reproduce this yet, but a friendly user sent me his non-working html source, so we'll just try
        // make a fix based on that. This is a temporary band aid until I can reproduce it myself.

        const videoSiblings = util.getAllElementSiblings(video);
        const divInstanceKey = videoSiblings.filter(elem => {
            return elem.matches('[data-instancekey]') && elem.querySelector('div[data-instancekey] > div[data-visualcompletion] div[role=presentation]');
            // return elem.matches('[data-instancekey]') && elem.querySelector('div[data-instancekey] > div[data-visualcompletion] > div[role=presentation]');
        })[0];

        if (divInstanceKey) {
            // New GUI style.
            const divVisualCompletion = divInstanceKey.querySelector('div[data-visualcompletion]');
            if (divVisualCompletion) {
                const divPresentation = divVisualCompletion.querySelector('div[role=presentation]');
                if (divPresentation) {
                    divVisualCompletion.style.setProperty('bottom', heightOfHtml5Controls);
                    divVisualCompletion.style.setProperty('height', `calc(100% - ${heightOfHtml5Controls})`);
                    if (!isInstagramReelsPage()) {
                        divPresentation.style.setProperty('bottom', heightOfHtml5Controls);
                    } else {
                        // Avoid double spacing on the reels page.
                        //divPresentation.style.setProperty('bottom', heightOfHtml5Controls);
                    }
                }
            }

            findVolumeOrTagsButtons(divInstanceKey, video).buttons.forEach(button => {
                // We don't need to raise the button since we raised the entire container.
                button.parentElement.classList.add('ctrls4insta-fade-button');
            });


            // On reels videos, they have a transparent grey background overlay on top of the video to make their white text stand out.
            // But, we move this div upwards so the video controls are clickable, which creates an ugly band where there's no background suddenly.
            // So, we disable the IG gradient, which gets darker towards the bottom, and replace it with a gradient that
            // is not only lighter, but also that gets extra light towards the very bottom. Kinda the opposite of the IG gradient.
            // Theirs is top to bottom: light to dark, ours is dark to light.
            // It should still help the user read the white text when the background video is also white/light, while not making such an ugly
            // visual disruption when the background shading ends.
            // But, the class name is likely to change and break...
            if (isInstagramReelsPage()) {
                const className = 'xutac5l';
                embedRootElem.querySelectorAll('.' + className).forEach(el => {
                    el.style.backgroundImage = 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.2) 98%, rgba(0,0,0,0) 100%)';
                    log('qqqqqq', el);
                });
            }

        } else {
            findVolumeOrTagsButtons(embedRootElem, video).buttons.forEach(button => {
                button.parentElement.classList.add('ctrls4insta-raise-button');
                button.parentElement.classList.add('ctrls4insta-fade-button');
            });
        }



    }

    // This will return a div right below the section element. Maybe the section is more reliable?
    function getComponentRootForStoryVideo(video) {
        function hasChildrenMatchingAllSelectors(elem, cssSelectors) {
            const childNodes = Array.from(elem.childNodes);
            return cssSelectors.every(selector => childNodes.some(node => node.matches(selector)));
        }

        for (let ancestor of nParents(video, 8)) {
            if (hasChildrenMatchingAllSelectors(ancestor, ['button', 'div', 'header'])) {
                return ancestor;
            }
        }
    }

    /**
     * We use height: calc(100% - 50px) on the video, but the 100% part won't work unless all the ancestors
     * have either height: 100% or a specific defined height. In the past, this was always the case, but recently
     * they added a new element to the ancestor chain which doesn't have such a height, and so it broke our sizing.
     * So, we walk up the ancestor chain and look for the element w/ missing height, and set it. Right now, they also
     * seem to set an inline width and height on one of the elements, but that value changes when resizing the window etc..
     *
     * Most of the elements get their height from a css class, so we look at the computed styles.
     * @param {Element} video
     */
    function ensure100PercentHeight(video) {
        // Going up 6 elements is a very generous upper limit. It should probably be like 4.
        for (let ancestor of nParents(video, 6)) {
            const style = ancestor.style;
            const computedStyle = window.getComputedStyle(ancestor);
            const heightAsDeclared = getPercentageCssRuleVal(ancestor, 'height');

            if (ancestor.tagName === 'SECTION') {
                // We went too far up. Stop.
                break;
            }

            // We can stop if we find an absolute height style - probably an inline style.
            if (/\d+px/.test(heightAsDeclared)) {
                break;
            }

            // If there's no height set, we set it.
            // Note: The element w/ the missing height has position: relative, but I'm not sure we should rely on that inline style
            // since other elements seem to get the same style via css class.
            if (heightAsDeclared === 'auto') {
                style.setProperty('height', '100%');
            }
        }
    }

    /**
     * Checks if a certain css property was set via inline style or css rule/class.
     *
     * @example stylePropertyExists('height', div.style) // inline style
     * @example stylePropertyExists('height', getComputedStyle(div)) // css style
     * @param {string} stylePropertyName
     * @param {CSSStyleDeclaration} styleObj
     */
    function stylePropertyExists(stylePropertyName, styleObj) {
        stylePropertyName = stylePropertyName.toLowerCase();
        for (let i = 0; i < styleObj.length; i++) {
            const item = styleObj.item(i).toLowerCase();
            if (item === stylePropertyName) {
                return true;
            }
        }
        return false;
    }

    /**
     * Hacky trick to get the original height css rule in percentage.
     * Normally, if you set height: XX% and then try to read the height via elem.style.height or getComputedStyle(),
     * the browser will give you the height in px, not percent.
     * But setting display: none prevents px calculation, so we temporarily do that to read the original rule.
     *
     * @param {Element} elem
     * @param {string} cssProperty
     * @returns {string}
     */
    function getPercentageCssRuleVal(elem, cssProperty) {
        const parentStyle = elem.parentElement.style;
        const prevDisplay = parentStyle.display;
        parentStyle.display = 'none';
        const cssRuleValue = getComputedStyle(elem)[cssProperty];
        parentStyle.display = prevDisplay;
        return cssRuleValue;
    }

    /**
     * On some stories videos, they overlay the video with a "send message" or "reply to <username>" textarea, but it lays on top of the video
     * player controls, making them difficult to use. So, we will identify these videos, and when found, we will reduce
     * the height of the video, so it moves upwards in its parent box, allowing the controls to be accessed. The
     * send message doesnt move - it stays fixed to the bottom of the parent.
     */
    function modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls(video) {
        // We need to take a few steps back up the tree before we will reach a position that can search for the textarea or like button.
        // note, sometimes componentRoot is null on some stories. rare. noticed Dec 2nd. this might happen if video removed from
        // dom before this func is called via setTimeout
        const componentRoot = getComponentRootForStoryVideo(video);
        const textarea = componentRoot.querySelector("textarea[placeholder]");
        function findLikeButton(componentRoot, video) {
            // The aria-label=Like value varies based on the browser language, so it's unreliable to look for the english word "Like".
            // So, we have a backup strategy if it fails, but it's not as robust.
            let likeButtonSvg = componentRoot.querySelector("[aria-label=Like]");
            if (likeButtonSvg) {
                return likeButtonSvg.closest('button');
            }

            // Otherwise we need to do some dom traversal and inspection to find it.

            // Find svg elems, but we dont want those that are descendant of a header.
            // They should however, be descendant of a button.
            return util.queryAll("button > * svg", componentRoot)
                .filter(el => !el.closest('header') && el.closest('button'))
                .map(el => el.closest('button'))[0];
        }

        const likeButton = findLikeButton(componentRoot, video);
        if (!textarea && !likeButton) {
            // log('no textarea or like button. no need to adjust height.');
            return;
        }

        // Find the height of the textarea or of a like button.
        const heightOfRow = (textarea || likeButton).getBoundingClientRect().height;
        const videoRect = video.getBoundingClientRect();
        // Now go upwards and find an element that is both nearly as wide as the video, but also
        // less than 2x the height of the row. That will be the container. We want the tallest one
        // that doesnt exceed 2x row height.
        let sendMessageContainer;
        for (let potentialSendMessageContainer of nParents(textarea || likeButton, 8)) {
            const potentialContainerRect = potentialSendMessageContainer.getBoundingClientRect();
            // We want a width within 25% of the video width.
            if (videoRect.width - potentialContainerRect.width < videoRect.width * 0.25) {
                // The height is usually just a smidge taller than the textarea or buttons, but too much taller.
                // There's a further ancestor thats about 3x the height, which container emoticons, and we do not want to
                // match that taller container, so we set a limit of 2x height.
                if (potentialContainerRect.height <= heightOfRow * 2) {
                    sendMessageContainer = potentialSendMessageContainer;
                } else {
                    // Once we encounter an elem thats too tall, we can stop looking for better matches.
                    break;
                }
            }
        }

        if (!sendMessageContainer) {
            log('no sendMessageContainer');
            return;
        }

        // This contains the video, the Send Message stuff, and many other buttons.
        const videoAndControlsContainer = componentRoot;

        // Sometimes the video parent is taller than its parent element. The overflow is hidden, which is a problem for us because
        // the controls on the bottom of the video might not be visible. Even if they are, this overflow makes it difficult for us to
        // calculate how much to shrink the video height, so we will change the size of the parent to match. I don't know why
        // instagram does this, but maybe they don't want to change the aspect ratio too much or something.
        const videoParentHeight = video.parentElement.getBoundingClientRect().height;
        const videoParentParentHeight = video.parentElement.parentElement.getBoundingClientRect().height;
        if (videoParentHeight > videoParentParentHeight) {
            log(`video parent height adjusted to ${videoParentParentHeight}px`);
            video.parentElement.style.height = videoParentParentHeight + 'px';
        }

        // We measure the height of the textarea ancestor element, because it's a bit larger and contains other elements, such as the submit button.
        const distanceFromTopOfSendMessageToBottomOfParentContainer = videoAndControlsContainer.getBoundingClientRect().bottom - sendMessageContainer.getBoundingClientRect().top;
        // If there's a textarea, we move a tiny bit more to make a nice looking gap. Not sure how reliable this nudge is, but whatever.
        // If there's no textarea, which implies there's only a like button, we don't move any less.
        const videoHeightAdjustment = distanceFromTopOfSendMessageToBottomOfParentContainer + (textarea ? 16 : 0);

        // Now, we change the height of the video, reducing it by the height of the problematic textarea box assembly.
        // The video should move upwards, leaving a black gap below it.
        ensure100PercentHeight(video);
        video.style.height = `calc(100% - ${videoHeightAdjustment}px)`;
        log(`video height adjusted to ${videoHeightAdjustment}px`);
    }

    function looksLikeCoversVideo(el, video) {
        const videoRect = video.getBoundingClientRect();
        function dimensionWithinXPercentOrAbsoluteValueOfEachOther(dimensionA, dimensionB, allowedRatio, absolutePixels) {
            return dimensionA && dimensionB && (
                Math.abs(dimensionA / dimensionB) <= allowedRatio
             || Math.abs(dimensionA - dimensionB) <= absolutePixels
            );
        }
        const rect = el.getBoundingClientRect();
        if (!dimensionWithinXPercentOrAbsoluteValueOfEachOther(videoRect.width, rect.width, 1.1, 100)) {
            return false;
        }
        if (!dimensionWithinXPercentOrAbsoluteValueOfEachOther(videoRect.height, rect.height, 1.2, 100)) {
            return false;
        }
        return true;
    }

    function getVideoCoveringButtons(searchRoot, video) {
        return util.queryAll("[role=button],[role=presentation]", searchRoot).filter(el => looksLikeCoversVideo(el, video));
    }

    /**
     * If you look in the dom, and traverse upwards from the video element, you'll soon find
     * a node which is the ancestor to both the video, and a div with role=button, and that div is big, covering the entire video.
     *
     * This func searches for that parent element. We use these as a sort of container element for the video and its
     * other controller pieces.
     *
     * @param {Element} video
     * @return {Element}
     */
    function getEstimatedVideoComponentRootElement(video) {
        for (const parent of nParents(video, 4)) {
            if (getVideoCoveringButtons(parent, video).length) {
                return parent;
            }
        }
        log("couldnt find parent", video);
    }

    /**
     * Returns N number of parents, ordered with the closest elements first.
     *
     * @param {Element} elem
     * @param {number} numParents
     * @return Element[]
     */
    function nParents(elem, numParents) {
        const parents = [];
        while (elem && --numParents >= 0) {
            elem = elem.parentElement;
            elem && parents.push(elem);
        }
        return parents;
    }

    function nthParent(elem, n) {
        while (elem && --n >= 0) {
            elem = elem.parentElement;
        }
        return elem;
    }

    function attachPageVisibilityListener() {
        // Not sure we need this anymore. Leaving for now until I'm sure mut observer
        // will queue up changes that happened when the tab is hidden/backgrounded.
        document.addEventListener('visibilitychange', util.recordEx('v.svmp', startVideoModificationPhase));
    }

    function startVideoModificationPhase() {
        ensureMutationObserverEnabled();
        // The first time this func is called, we scan the dom and try to find all video elements.
        // But we also setup a mutation observer which looks for new video elements, and the observer should
        // eliminate the need for polling.
        // But, somehow some video elements arent detected by the mutation observer, and so we cant rely on the observer to find
        // all new videos. Instead we must poll until I figure out why.
        util.recordEx('mv', modifyAllPresentVideos)();
    }

    function ensureMutationObserverEnabled() {
        // Prevent multiple observers.
        if (ensureMutationObserverEnabled.enabled) {
            return;
        } else {
            ensureMutationObserverEnabled.enabled = true;
        }
        log(`ensureMutationObserverEnabled`);

        function callback(mutations) {
            const videos = [];
            mutations.forEach(mutation => {
                //console.log(`added = ${mutation.addedNodes.length} rem = ${mutation.removedNodes.length}`, mutation);
                mutation.addedNodes.forEach(node => {
                    if (node.tagName === 'VIDEO') {
                        log('found vid mut', node);
                        videos.push(node);
                    }

                    // Some nodes don't have this method. Probably stuff like text nodes etc...
                    if (node.querySelectorAll) {
                        // Oddly, we never find videos directly. They're always found as an ancestor for some reason.
                        const vids = node.querySelectorAll('video');
                        if (vids.length) {
                            log('found vids recurse', vids);
                            videos.push(...vids);
                        }
                    }
                });
            });

            if (videos.length) {
                log(`videos.length = ${videos.length}`, videos);
                log('found new vids at', new Date().toISOString());
                videos.forEach(modifyVideo);
            }
        }

        const observer = new MutationObserver(util.recordEx('mo', callback));
        observer.observe(document.body, {subtree: true, childList: true});
    }

    function isInstagramStoriesPage() {
        return window.location.pathname.toLowerCase().startsWith('/stories/');
    }

    function isInstagramReelsPage() {
        return window.location.pathname.toLowerCase().startsWith('/reels/');
    }

    function fixStringConfigKeys(config) {
        // Some users have strings saved in storage, so we need to cast to number.
        ['volumeLevel', 'playbackRate'].forEach(key => {
            if (typeof config[key] === 'string') {
                config[key] = Number(config[key]);
            }
        });
        return config;
    }

    function getSavedConfig() {
        return new Promise((resolve, reject) => {
            const defaults = {
                rememberVolumeLevel: true,
                rememberPlaybackRate: true,
                volumeLevel: 1,
                playbackRate: 1,
                volumeAdjustmentStepSize: 0.1,
                playbackRateAdjustmentStepSize: 0.125,
            };
            chrome.storage.local.get(defaults, resolve);
        }).then(fixStringConfigKeys);
    }

    function saveUserConfig(config) {
        chrome.storage.local.set(config, () => {});
    }

    const log = showLog ? console.log : () => {};

    function setupStorageChangeListener(that) {
        // Chrome hotkeys / commands don't give us an easy way to determine which tab they occurred in, if any.
        // But we only want to update video speed or volume of videos running in the same tab as the hotkey,
        // so we need to determine the tab, because the hotkey handler will update chrome.storage, which will then
        // trigger the storage change listener in each tab.
        // We expect when the user presses the hotkey in this tab that the document.keyup event will fire in this tab,
        // and then a short moment later the chrome.storage event will fire (as a result of chrome hotkey handler
        // being triggered and executing our service worker / background script, which updates the storage).
        // But, sometimes the document.keyup handler actually fires AFTER the storage event, making our job of
        // identifying the event origin tab tougher.
        // What we do is have each tab locally record a timestamp for all keyup events, so a few millis later
        // when the storage change listener fires, we can look at the timestamp, and if it was recent enough, we
        // can assume the hotkey was fired in our tab. But, since the storage event sometimes happens before the keyup event,
        // we need to be more tricky. What we do is when the storage event fires, we queue up a worker to check in a few more millis to see
        // if the keyup event fired. I hate relying on timing like this. It might be buggy for a heavily loaded system
        // when 25ms isnt enough time for both events to happen. Oh well.
        // Note we must use keyup not keydown - keydown won't fire when a chrome defined hotkey combo is pressed.
        const maxMillisToAssumeHotkeyOccurredInThisTab = 500;
        let lastKeyup;
        document.body.addEventListener('keyup', evt => {
            lastKeyup = new Date().getTime();
            log('keyup', dtFmt());
        });

        function dtFmt(d) {
            d = (d || new Date());
            return `${d.getMinutes()}-${d.getSeconds()}.${d.getMilliseconds()}`;
        }

        /**
         * A small utility to do something generic in an async loop.
         *
         * Calls the callbackFn every intervalMillis until maxMillis time has elapsed.
         * The callback is also passed an object with a method named "stop", which if called,
         * will prevent your callback from being called additional times, even if the maxMillis
         * elapsed time hasn't yet been exceeded.
         *
         * @param {function} callbackFn
         * @param {number} intervalMillis
         * @param {number} maxMillis
         */
        function loopAsync(callbackFn, intervalMillis, maxMillis) {
            const intervalStart = new Date().getTime();
            const intervalId = setInterval(() => {
                if (new Date().getTime() - intervalStart > maxMillis) {
                    clearInterval(intervalId);
                    //log(`loopAsync expired naturally ${new Date().getTime() - intervalStart} ${new Date().getTime()} - ${intervalStart} > ${maxMillis}`);
                }
                const remoteControl = {
                    stop: () => {
                        clearInterval(intervalId);
                        log(`loopAsync stopped`);
                    },
                    intervalStart,
                    intervalMillis,
                    maxMillis
                };
                callbackFn(remoteControl);
            }, intervalMillis);
        }

        chrome.storage.onChanged.addListener(configChange => {
            log('storage.onChanged', dtFmt(), configChange);
            const start = new Date().getTime();
            const shouldUpdateVolume = 'volumeLevel' in configChange;
            const shouldUpdatePlaybackRate = 'playbackRate' in configChange;
            const previousConfig = config;
            getSavedConfig().then(newConfig => {
                config = newConfig;
                loopAsync((remoteControl) => {
                    if (lastKeyup && now() - lastKeyup < maxMillisToAssumeHotkeyOccurredInThisTab) {
                        remoteControl.stop();
                        log('key happened in this tab', {shouldUpdateVolume, shouldUpdatePlaybackRate});
                        if (shouldUpdateVolume && previousConfig.volumeLevel !== config.volumeLevel) {
                            // Update volume for all videos in this tab.
                            log('update volume in this tab');
                            setVolumeOfPreviouslySeenVideoElements(config.volumeLevel);
                        }
                        if (shouldUpdatePlaybackRate && previousConfig.playbackRate !== config.playbackRate) {
                            // Update playback speed for all videos in this tab.
                            log('update playbackRate in this tab');
                            setPlaybackRateOfPreviouslySeenVideoElements(config.playbackRate);
                        }
                    }
                }, 25, 500);
            });
        });
    }

    this.init = util.recordEx('init', function init() {
        // We must load the config before we initialize the extension.
        getSavedConfig().then(newConfig => {
            config = newConfig;
            attachPageVisibilityListener();
            startVideoModificationPhase();
            setInterval(startVideoModificationPhase, 200);
            moveReactionBarIntervalHandle = setInterval(modifyVideoElementsControls, 200);
            redefineWebkitMediaControlHidingCssRule();
            setupStorageChangeListener(this);
            util.recordUsageStats('initOk');
            initialized = true;
        });

    });

}
