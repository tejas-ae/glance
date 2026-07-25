# Glance Demo Runbook

## Night before

Glance should be private and scaled to zero:

```bash
GOOGLE_CLOUD_PROJECT=project-e306111f-63fe-43c2-9d9 ./infra/lock.sh
```

An unauthenticated check should return `403` for both URLs:

```bash
curl -o /dev/null -s -w '%{http_code}\n' \
  https://glance-backend-440551306705.us-central1.run.app/health
curl -o /dev/null -s -w '%{http_code}\n' \
  https://glance-frontend-440551306705.us-central1.run.app/
```

## Thirty minutes before presenting

1. Run the enable command and wait for all three verification lines:

   ```bash
   GOOGLE_CLOUD_PROJECT=project-e306111f-63fe-43c2-9d9 \
     ./infra/enable-demo.sh
   ```

2. Open:
   `https://glance-frontend-440551306705.us-central1.run.app`
3. Generate a private room code with `echo "glance-demo-$(openssl rand -hex 4)"`
   and paste the result into the room field.
4. Confirm the connection pill turns green.
5. Click **Share screen** and share only the prepared demo window.
6. Allow microphone access and confirm the audio buffer begins filling.
7. Confirm laptop volume is audible and Do Not Disturb is enabled.
8. Keep the tested browser tab open. Do not redeploy after this check.

## Click-by-click story

1. Show a diagram, chart, or code block with one obvious target region.
2. Say: “This green box is the session artifact we use to revisit exactly
   what the team was discussing.”
3. Wait about ten seconds so the sentence is inside the audio buffer.
4. Drag a box around the target region.
5. Point out the red spatial highlight while the answer streams.
6. Call out the grounding quote that repeats the spoken vocabulary.
7. Let the speech begin before the text finishes.
8. Select **Spanish**, ask the same question, and show text and speech changing.
9. Click **Recap** and show the stored thumbnail, question, answer, and latency.
10. Close with: “Meeting AI usually listens. Glance looks where I point and
    listens to what the team just said.”

## Fast recovery

- Red connection pill: wait ten seconds for reconnect, then refresh once.
- Microphone error: keep the screen share and explain that visual-only mode
  degrades honestly by saying no relevant audio was available.
- No speech: continue with streamed text; the player will label speech as
  unavailable instead of blocking the explanation.
- Model error: drag the region again once.
- Screen permission mistake: stop sharing and restart with the prepared window.
- Worst case: open the tested recap room prepared during preflight.

## Immediately after presenting

Run:

```bash
GOOGLE_CLOUD_PROJECT=project-e306111f-63fe-43c2-9d9 ./infra/lock.sh
```

Confirm both public URLs return `403`. This stops unauthenticated API use and
allows both Cloud Run services to scale to zero. Firestore data and GitHub code
remain intact.
