import React, { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View, type View as NativeView } from "react-native";
import { BlurTargetView, BlurView } from "expo-blur";
import { VideoView, useVideoPlayer, type VideoSource } from "expo-video";

const backgroundVideos: VideoSource[] = [
  require("../../assets/animals/videos/6235180-uhd_2160_3840_25fps.mp4"),
  require("../../assets/animals/videos/15667169_2160_3840_30fps.mp4"),
  require("../../assets/animals/videos/15089070_2160_3840_16fps.mp4"),
];

let lastVideoIndex = -1;

function getNextRandomVideoIndex() {
  let nextIndex = Math.floor(Math.random() * backgroundVideos.length);

  while (backgroundVideos.length > 1 && nextIndex === lastVideoIndex) {
    nextIndex = Math.floor(Math.random() * backgroundVideos.length);
  }

  lastVideoIndex = nextIndex;
  return nextIndex;
}

export default function RandomVideoBackground() {
  const blurTargetRef = useRef<NativeView>(null);
  const [firstFrameRendered, setFirstFrameRendered] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);
  const player = useVideoPlayer(null, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.volume = 0;
  });

  useEffect(() => {
    const selectedVideo = backgroundVideos[getNextRandomVideoIndex()];

    void player.replaceAsync(selectedVideo).then(() => player.play());
  }, [player]);

  useEffect(() => {
    if (!firstFrameRendered) {
      return;
    }

    // Android's decoder and blur surface can still redraw briefly immediately
    // after the first frame. Keep the cover in place until both have settled.
    const revealTimer = setTimeout(() => setVideoVisible(true), 180);
    return () => clearTimeout(revealTimer);
  }, [firstFrameRendered]);

  return (
    <>
      <BlurTargetView ref={blurTargetRef} style={styles.video}>
        <VideoView
          contentFit="cover"
          nativeControls={false}
          onFirstFrameRender={() => setFirstFrameRendered(true)}
          player={player}
          style={styles.video}
          surfaceType={Platform.OS === "android" ? "textureView" : undefined}
        />
      </BlurTargetView>
      <BlurView
        blurMethod={Platform.OS === "android" ? "dimezisBlurViewSdk31Plus" : undefined}
        blurTarget={blurTargetRef}
        intensity={14}
        style={styles.blur}
        tint="dark"
      />
      {!videoVisible ? <View pointerEvents="none" style={styles.startupCover} /> : null}
      <View style={styles.overlay} />
    </>
  );
}

const styles = StyleSheet.create({
  video: {
    ...StyleSheet.absoluteFill,
  },
  blur: {
    ...StyleSheet.absoluteFill,
  },
  startupCover: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#0f172a",
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(8, 18, 26, 0.48)",
  },
});
