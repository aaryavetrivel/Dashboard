CONVEYOR DASHBOARD UPDATE

Files:
- index.html
- style.css
- script.js

Alarm-stop behavior:
- Warning thresholds: alert only, motor continues running.
- Temperature, software-derived current, or vibration at/above its configured alarm threshold for 3 consecutive samples: automatic stop and fault latch.
- RPM below 70% of the commanded target while the motor is commanded to run, for 3 consecutive samples: automatic stop and fault latch.
- Existing diagnosed critical fault patterns also stop the motor.
- Acknowledge is required after inspection; the motor remains stopped until Start is pressed.
- Demo mode stops only the simulated motor. Live mode requests a stop from the ESP32.

IMPORTANT SAFETY NOTE:
The browser dashboard is supervisory software, not a safety-rated controller. For a real conveyor, implement independent alarm detection and motor shutdown in the ESP32 firmware (or a suitable hardware safety circuit). A browser/network failure can prevent a stop request reaching the ESP32.

CURRENT CHANNEL NOTE:
The dashboard's current channel remains software-derived from RPM, vibration, temperature and slip. It is not a direct ACS712 measurement. The CSV metadata retains this disclosure.

Deploy:
Upload index.html, style.css and script.js together to your existing static hosting project. Keep all three in the same directory.
