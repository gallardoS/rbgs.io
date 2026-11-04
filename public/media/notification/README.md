# Notification artwork

`plunderstorm-new-dot-lg.webp` is the original blue notification diamond extracted
from the locally installed TBC Anniversary client, build **2.5.6.70006**
(`wow_anniversary`), converted to lossless WebP with its alpha channel preserved.

- Atlas member: `plunderstorm-new-dot-lg` (UiTextureAtlasMember ID 29941).
- Atlas: 2683, FileDataID **5456935**, 2048 × 2048 pixels.
- Crop: left 1359, top 527, right 1399, bottom 567 (40 × 40 pixels).
- Client template: `Interface/AddOns/Blizzard_Notification/Blizzard_Notification.xml`.
  `NotificationIconFrameTemplate` displays it at 25 × 25 pixels;
  `LargeNotificationIconFrameTemplate` uses 30 × 30. Both are static.
- Reference: https://github.com/Gethe/wow-ui-source/blob/classic_anniversary/Interface/AddOns/Blizzard_Notification/Blizzard_Notification.xml

Use `<NotificationDot />` for a decorative indicator next to an existing label,
or `<NotificationDot aria-label="Unread updates" />` for an accessible image.
`size={30}` changes its dimensions; `animate` enables an optional two-second
pulse (disabled when the user prefers reduced motion).

The existing `collections-newglow.webp` belongs to the `Notification` text marker.

## Match Ready audio

`match-ready-ping.wav` is React Bits Sound Lab **Notify / Ping**, exported with
its default recipe and engine (2026-11-03), 44.1 kHz stereo PCM16.
The sound is served locally and used once for each new Match Ready proposal.
Source: https://reactbits.dev/tools/sound-lab and
https://reactbits.dev/r/SoundPing-TS.json.
See `react-bits-LICENSE.txt` for the upstream copyright and license.

`match-ready-circuit.wav` adds the official **Circuit** preset, rendered with
the same engine and default tuning. Source:
https://reactbits.dev/r/SoundCircuit-TS.json. It shares the upstream license.
Ping remains the default; users can choose either sound in Play, Settings or
the local simulator and preview it before queuing.

`match-ready-petal.wav` is the official Petal preset rendered with Length set to 2×.
Source: https://reactbits.dev/r/SoundPetal-TS.json. The same React Bits license applies.
