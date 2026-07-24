"use client";

import { useState, type PointerEvent, type RefObject } from "react";

import type { BBox } from "@/lib/types";

type ScreenShareProps = {
  active: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  aspectRatio: number;
  bbox: BBox | null;
  showBbox: boolean;
  onVideoReady: () => void;
  onSelection: (bbox: BBox) => void;
};

type Point = { x: number; y: number };

export default function ScreenShare({
  active,
  videoRef,
  aspectRatio,
  bbox,
  showBbox,
  onVideoReady,
  onSelection,
}: ScreenShareProps) {
  const [start, setStart] = useState<Point | null>(null);
  const [current, setCurrent] = useState<Point | null>(null);
  const draft = start && current ? boxFromPoints(start, current) : null;

  function pointFromEvent(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height),
    };
  }

  function beginSelection(event: PointerEvent<HTMLDivElement>) {
    if (!active) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    setStart(point);
    setCurrent(point);
  }

  function moveSelection(event: PointerEvent<HTMLDivElement>) {
    if (start) setCurrent(pointFromEvent(event));
  }

  function endSelection(event: PointerEvent<HTMLDivElement>) {
    if (!start) return;
    const selection = boxFromPoints(start, pointFromEvent(event));
    setStart(null);
    setCurrent(null);
    if (selection.width >= 0.01 && selection.height >= 0.01) {
      onSelection(selection);
    }
  }

  return (
    <div
      className={`screen-stage ${active ? "is-selectable" : ""}`}
      style={{ aspectRatio }}
      onPointerDown={beginSelection}
      onPointerMove={moveSelection}
      onPointerUp={endSelection}
      onPointerCancel={() => {
        setStart(null);
        setCurrent(null);
      }}
    >
      <video ref={videoRef} autoPlay muted playsInline onLoadedMetadata={onVideoReady} />
      {!active && (
        <div className="placeholder-content">
          <div className="placeholder-icon" aria-hidden="true">↗</div>
          <strong>Your shared screen will appear here</strong>
          <p>Share a screen, then drag directly over any region to capture it.</p>
        </div>
      )}
      {active && !draft && !bbox && (
        <div className="selection-hint">Drag over anything you want explained</div>
      )}
      {draft && <SelectionBox bbox={draft} draft />}
      {!draft && showBbox && bbox && <SelectionBox bbox={bbox} />}
    </div>
  );
}

function SelectionBox({ bbox, draft = false }: { bbox: BBox; draft?: boolean }) {
  return (
    <div
      className={`selection-box ${draft ? "is-draft" : ""}`}
      style={{
        left: `${bbox.x * 100}%`,
        top: `${bbox.y * 100}%`,
        width: `${bbox.width * 100}%`,
        height: `${bbox.height * 100}%`,
      }}
    />
  );
}

function boxFromPoints(start: Point, end: Point): BBox {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}
