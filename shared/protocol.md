# Glance WebSocket Protocol

This document is the source of truth for messages exchanged over Glance's
WebSocket connection. JSON is UTF-8 encoded. Binary media is base64 encoded
inside JSON during the hackathon build.

## Conventions

- `bbox` values are normalized from `0` to `1`, never pixels. The source
  screen, video track, and canvas can all have different dimensions.
- Every server message carries the originating `request_id`.
- A client tracks its latest tap and discards messages whose `request_id` is
  stale. Latest tap wins.
- Every `error` contains `code`, `message`, and `retryable: bool`.
- Audio is raw signed 16-bit little-endian PCM, mono, at 16 kHz unless a
  message explicitly says otherwise.
- The client keeps a rolling audio buffer sized to the largest lookback
  window it offers (currently 120s), frozen into a snapshot at the moment
  of each tap. The user picks how much of that snapshot to actually send
  (e.g. 30s/60s/120s) before or after the request goes out; the server
  infers the actual duration from the payload length rather than trusting
  a separate field.
- Times are UTC ISO 8601 strings; durations and offsets are milliseconds or
  seconds as named.
- Room IDs are 1–64 lowercase letters, digits, or hyphens. Request and client
  IDs are 1–128 characters.
- Questions are 1–500 characters and language names are 1–40 characters.
- Each full/crop image is limited to 4 MB of base64 text, thumbnails to
  300 KB, and audio to 5.5 MB (enough for the 120s max lookback window).

## Client to server

### `join`

```json
{"type":"join","request_id":"join_01JAZ8M7K7Q","room_id":"demo-room","client_id":"client_9d18"}
```
| Field | Type | Required | Meaning |
|---|---|---:|---|
| `type` | `"join"` | yes | Message discriminator. |
| `request_id` | string | yes | Unique ID used to correlate the acknowledgement. |
| `room_id` | string | yes | Human-entered room code. |
| `client_id` | string | yes | In-memory ID for this browser tab. |

### `ping`

```json
{"type":"ping","request_id":"ping_01JAZ8N1D2C","room_id":"demo-room"}
```
| Field | Type | Required | Meaning |
|---|---|---:|---|
| `type` | `"ping"` | yes | Message discriminator. |
| `request_id` | string | yes | Unique ID used to measure this round trip. |
| `room_id` | string | yes | Current room code. |

### `explain_request`

```json
{"type":"explain_request","request_id":"req_01JAZ8PN4ND","room_id":"demo-room","bbox":{"x":0.12,"y":0.18,"width":0.31,"height":0.22},"annotated_frame_jpeg_base64":"/9j/4AAQSkZJRg...","crop_jpeg_base64":"/9j/4AAQSkZJRg...","thumbnail_jpeg_base64":"/9j/4AAQSkZJRg...","audio_pcm16_base64":"AACQ/2kA...","audio_sample_rate_hz":16000,"question":"What does this part mean?","language":"English"}
```
| Field | Type | Required | Meaning |
|---|---|---:|---|
| `type` | `"explain_request"` | yes | Message discriminator. |
| `request_id` | string | yes | Unique ID for this tap. |
| `room_id` | string | yes | Room receiving the explanation artifact. |
| `bbox` | object | yes | Normalized selection: `x`, `y`, `width`, `height`. |
| `annotated_frame_jpeg_base64` | string | yes | Full frame, at most 1280 px on its longest edge, with a red selection rectangle. |
| `crop_jpeg_base64` | string | yes | Tight selected-region crop with about 8% padding. |
| `thumbnail_jpeg_base64` | string | yes | Small recap-only JPEG; it is stored but never sent to Gemini. |
| `audio_pcm16_base64` | string | yes | Raw mono PCM for the client's chosen lookback window (30s/60s/120s), ending at the moment of selection. Its actual duration is derived server-side from its length, not trusted from any separate field. |
| `audio_sample_rate_hz` | integer | yes | PCM sample rate; currently `16000`. |
| `question` | string | yes | User's typed or default question. |
| `language` | string | yes | Requested answer and speech language. |

### `cancel`

```json
{"type":"cancel","request_id":"cancel_01JAZ8Q0X1A","room_id":"demo-room","target_request_id":"req_01JAZ8PN4ND"}
```
| Field | Type | Required | Meaning |
|---|---|---:|---|
| `type` | `"cancel"` | yes | Message discriminator. |
| `request_id` | string | yes | Unique ID for this cancellation. |
| `room_id` | string | yes | Current room code. |
| `target_request_id` | string | yes | The `explain_request` to stop, if it is still running. |

Cancelling stops in-progress text generation and speech synthesis for
`target_request_id` and suppresses any further `text_delta`, `grounding`,
`audio_delta`, or `done` messages for it. A `cancel` for a request that has
already finished or was already superseded by a newer `explain_request` is a
harmless no-op.

### `follow_up`

```json
{"type":"follow_up","request_id":"req_01JAZ8TAP3G","room_id":"demo-room","parent_request_id":"req_01JAZ8PN4ND","question":"How does that affect the next step?","language":"English"}
```
| Field | Type | Required | Meaning |
|---|---|---:|---|
| `type` | `"follow_up"` | yes | Message discriminator. |
| `request_id` | string | yes | Unique ID for this follow-up. |
| `room_id` | string | yes | Current room code. |
| `parent_request_id` | string | yes | Explanation this question follows. |
| `question` | string | yes | Follow-up question. |
| `language` | string | yes | Requested answer and speech language. |

## Server to client

### `ack`

```json
{"type":"ack","request_id":"join_01JAZ8M7K7Q","room_id":"demo-room","kind":"joined","server_time":"2026-07-24T16:20:00Z"}
```
| Field | Type | Required | Meaning |
|---|---|---:|---|
| `type` | `"ack"` | yes | Message discriminator. |
| `request_id` | string | yes | Originating client request. |
| `room_id` | string | yes | Room the server acknowledged. |
| `kind` | `"joined"`, `"pong"`, `"request_received"`, or `"cancelled"` | yes | What was acknowledged. |
| `server_time` | string | yes | UTC ISO 8601 server time. |

### `text_delta`

```json
{"type":"text_delta","request_id":"req_01JAZ8PN4ND","seq":0,"delta":"The red arrow represents "}
```
| Field | Type | Required | Meaning |
|---|---|---:|---|
| `type` | `"text_delta"` | yes | Message discriminator. |
| `request_id` | string | yes | Originating explanation request. |
| `seq` | integer | yes | Zero-based text fragment sequence. |
| `delta` | string | yes | Text to append. |

### `grounding`

```json
{"type":"grounding","request_id":"req_01JAZ8PN4ND","grounding_quote":"we fan the result out to both workers","grounding_offset_seconds":-10.4,"confidence":0.91,"region_label":"fan-out arrow"}
```
| Field | Type | Required | Meaning |
|---|---|---:|---|
| `type` | `"grounding"` | yes | Message discriminator. |
| `request_id` | string | yes | Originating explanation request. |
| `grounding_quote` | string | yes | Short quote or paraphrase from the audio. |
| `grounding_offset_seconds` | number or null | yes | Seconds before the tap; null when ungrounded. |
| `confidence` | number | yes | Model confidence from `0` to `1`. |
| `region_label` | string | yes | Concise name for the selected visual region. |

### `audio_delta`

```json
{"type":"audio_delta","request_id":"req_01JAZ8PN4ND","seq":0,"audio_pcm16_base64":"AACQ/2kA...","audio_sample_rate_hz":24000}
```
| Field | Type | Required | Meaning |
|---|---|---:|---|
| `type` | `"audio_delta"` | yes | Message discriminator. |
| `request_id` | string | yes | Originating explanation request. |
| `seq` | integer | yes | Zero-based audio segment sequence. |
| `audio_pcm16_base64` | string | yes | Raw signed 16-bit little-endian mono PCM. |
| `audio_sample_rate_hz` | integer | yes | Playback sample rate for this segment. |

### `done`

```json
{"type":"done","request_id":"req_01JAZ8PN4ND","latency_ms":1842,"audio_available":true}
```
| Field | Type | Required | Meaning |
|---|---|---:|---|
| `type` | `"done"` | yes | Message discriminator. |
| `request_id` | string | yes | Originating explanation request. |
| `latency_ms` | integer | yes | End-to-end server processing time. |
| `audio_available` | boolean | yes | Whether at least one TTS audio segment was delivered. |

### `error`

```json
{"type":"error","request_id":"req_01JAZ8PN4ND","code":"MODEL_UNAVAILABLE","message":"The explanation model is temporarily unavailable.","retryable":true}
```
| Field | Type | Required | Meaning |
|---|---|---:|---|
| `type` | `"error"` | yes | Message discriminator. |
| `request_id` | string | yes | Originating request, including failed joins. |
| `code` | string | yes | Stable machine-readable error code. |
| `message` | string | yes | Safe, human-readable explanation. |
| `retryable` | boolean | yes | Whether retrying the same action may succeed. |
