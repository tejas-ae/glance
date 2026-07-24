import type { BBox } from "./types";

type ReusableCanvas = OffscreenCanvas | HTMLCanvasElement;

let frameCanvas: ReusableCanvas | null = null;
let cropCanvas: ReusableCanvas | null = null;
let thumbnailCanvas: ReusableCanvas | null = null;

export type CaptureImages = {
  annotatedFrame: string;
  crop: string;
  thumbnail: string;
};

export async function captureSelection(
  video: HTMLVideoElement,
  bbox: BBox,
): Promise<CaptureImages> {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("The shared screen has not produced a frame yet.");
  }

  const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
  const frameWidth = Math.round(video.videoWidth * scale);
  const frameHeight = Math.round(video.videoHeight * scale);
  frameCanvas = prepareCanvas(frameCanvas, frameWidth, frameHeight);
  const frameContext = getContext(frameCanvas);
  frameContext.drawImage(video, 0, 0, frameWidth, frameHeight);

  frameContext.strokeStyle = "#ff3b30";
  frameContext.lineWidth = Math.max(4, Math.round(Math.min(frameWidth, frameHeight) * 0.006));
  frameContext.strokeRect(
    bbox.x * frameWidth,
    bbox.y * frameHeight,
    bbox.width * frameWidth,
    bbox.height * frameHeight,
  );

  const padX = bbox.width * 0.08;
  const padY = bbox.height * 0.08;
  const x = Math.max(0, bbox.x - padX);
  const y = Math.max(0, bbox.y - padY);
  const right = Math.min(1, bbox.x + bbox.width + padX);
  const bottom = Math.min(1, bbox.y + bbox.height + padY);
  const sourceX = Math.round(x * video.videoWidth);
  const sourceY = Math.round(y * video.videoHeight);
  const sourceWidth = Math.max(1, Math.round((right - x) * video.videoWidth));
  const sourceHeight = Math.max(1, Math.round((bottom - y) * video.videoHeight));
  const cropScale = Math.min(1, 1280 / Math.max(sourceWidth, sourceHeight));

  cropCanvas = prepareCanvas(
    cropCanvas,
    Math.round(sourceWidth * cropScale),
    Math.round(sourceHeight * cropScale),
  );
  getContext(cropCanvas).drawImage(
    video,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    cropCanvas.width,
    cropCanvas.height,
  );

  const thumbnailScale = Math.min(1, 320 / Math.max(cropCanvas.width, cropCanvas.height));
  thumbnailCanvas = prepareCanvas(
    thumbnailCanvas,
    Math.max(1, Math.round(cropCanvas.width * thumbnailScale)),
    Math.max(1, Math.round(cropCanvas.height * thumbnailScale)),
  );
  getContext(thumbnailCanvas).drawImage(
    cropCanvas,
    0,
    0,
    thumbnailCanvas.width,
    thumbnailCanvas.height,
  );

  const [annotatedFrame, crop, thumbnail] = await Promise.all([
    canvasToBase64(frameCanvas),
    canvasToBase64(cropCanvas),
    canvasToBase64(thumbnailCanvas, 0.72),
  ]);
  return { annotatedFrame, crop, thumbnail };
}

function prepareCanvas(canvas: ReusableCanvas | null, width: number, height: number) {
  const next =
    canvas ??
    (typeof OffscreenCanvas === "undefined"
      ? document.createElement("canvas")
      : new OffscreenCanvas(width, height));
  next.width = width;
  next.height = height;
  return next;
}

function getContext(canvas: ReusableCanvas) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D rendering is unavailable.");
  return context as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
}

async function canvasToBase64(canvas: ReusableCanvas, quality = 0.86) {
  const blob =
    typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas
      ? await canvas.convertToBlob({ type: "image/jpeg", quality })
      : await new Promise<Blob>((resolve, reject) =>
          (canvas as HTMLCanvasElement).toBlob(
            (value) => (value ? resolve(value) : reject(new Error("JPEG encoding failed."))),
            "image/jpeg",
            quality,
          ),
        );
  return blobToBase64(blob);
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",", 2)[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
