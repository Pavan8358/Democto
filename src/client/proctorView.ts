import { ManifestPlayer } from "./playback/manifestPlayer";

export interface ProctorViewOptions {
  container: HTMLElement;
  manifestUrl: string;
}

export const initProctorView = async ({ container, manifestUrl }: ProctorViewOptions) => {
  const video = document.createElement("video");
  video.controls = true;
  video.autoplay = false;
  video.style.width = "100%";
  video.style.maxHeight = "480px";
  container.innerHTML = "";
  container.appendChild(video);

  const player = new ManifestPlayer({ manifestUrl, videoElement: video });
  await player.load();
};
