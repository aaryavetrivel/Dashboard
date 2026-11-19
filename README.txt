CONVEYOR MONITOR DASHBOARD - WHITE THEME + FAULT ALERT

Files:
- index.html
- style.css
- script.js

What changed:
1. Reworked the interface into a clean white/light theme with white cards, subtle shadows, clearer typography and a blue-toned conveyor status panel.
2. Added a prominent fault alert banner. When the existing automatic fault interlock latches, the banner appears with a pulsing red warning icon, fault reason and interlock status.
3. Added a soft red pulse around the page edge and a red emphasis around the conveyor panel while a fault is latched.
4. The fault alert stays visible until the operator acknowledges the fault after clearing its cause. Acknowledgement does not restart the motor; Start must still be pressed.
5. Respects reduced-motion accessibility settings.

Preserved existing dashboard behavior and controls:
- Demo and Live ESP32 modes
- Motor start, stop, speed controls and fault acknowledgement
- Automatic fault-stop logic and motor lockout
- Sensor cards, diagnosis table, alert log and threshold settings
- Calibration, graph plotting, per-graph CSV/PNG downloads and research CSV export

Deployment:
Upload all three files to the same folder in your Vercel project, keeping these exact names. Deploy the project as usual.

Important:
The red dashboard alert is a visual indication of the dashboard's existing fault latch. It is not a safety-rated emergency-stop system. The ESP32 firmware/hardware interlock must independently stop the physical motor if required.
