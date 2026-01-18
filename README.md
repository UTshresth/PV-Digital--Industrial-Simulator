# ☀️ PV_DIGITAL __INDUSTRIAL SIMULATOR

A high-performance, web-based simulation tool for analyzing Solar Photovoltaic systems. This project visualizes the relationship between environmental factors (Irradiance, Temperature), solar panel specifications, and DC-DC converter performance in real-time.

![Project Status](https://img.shields.io/badge/Status-Active-success)
![Tech Stack](https://img.shields.io/badge/Built%20With-JavaScript%20|%20Chart.js%20|%20HTML5-blue)

## 🚀 Key Features

* **Real-Time Physics Engine:** Calculates $V_{oc}$, $I_{sc}$, and Efficiency based on live inputs (Temperature & Irradiance).
* **Multi-Topology Support:** Simulates **Buck**, **Boost**, and **Buck-Boost** converters with realistic duty cycle clamping (0.05 - 0.95) and load droop control.
* **Dynamic MPPT Tracking:** Visualizes Maximum Power Point Tracking logic (P&O / Incremental Conductance).
* **Interactive Dashboard:**
    * **P-V & I-V Characteristic Curves:** Updates instantly when panel config or weather changes.
    * **PWM Scope:** Simulates the Gate Driver switching signal based on the calculated Duty Cycle.
* **Automated PDF Reports:** Generates professional analysis reports with high-resolution snapshots of all system graphs.

## 🛠️ Technical Highlights

### 1. Smart State Management
Unlike standard simulators that redraw canvases on every frame (causing lag), this project uses a **State Change Detection System**. The graphs only update when specific parameters change (e.g., Irradiance $\Delta > 1W$, Temperature $\Delta > 0.5^\circ C$), reducing CPU usage by over 90% while idle.

### 2. Background Graph Rendering
A common issue in web simulators is that hidden graphs (e.g., inside a closed dashboard) render as blank images in PDF reports.
* **Solution:** This project utilizes an "Off-Screen Rendering" technique.
* The dashboard is positioned off-screen (`top: 100%`) rather than hidden (`display: none`), ensuring the DOM elements retain their dimensions.
* Chart.js is initialized with `animation: false` to ensure instant, complete line drawing for PDF snapshots.

## 📦 How to Run

1.  Clone the repository:
    ```bash
    git clone [https://github.com/YOUR_USERNAME/solar-sim-dashboard.git](https://github.com/YOUR_USERNAME/solar-sim-dashboard.git)
    ```
2.  Navigate to the project folder.
3.  Open `index.html` in any modern web browser (Chrome, Edge, Firefox).
4.  No backend, node_modules, or installation required!

## 📸 How to Use

1.  **Configure Panel:** Select your solar panel brand and Series/Parallel configuration.
2.  **Set Environment:** Use sliders to adjust Irradiance ($W/m^2$) and Temperature ($^\circ C$).
3.  **Select Converter:** Choose between Buck, Boost, or Buck-Boost to see how the system regulates voltage.
4.  **Analyze:** Open the Dashboard to view the live Oscilloscope and Characteristic curves.
5.  **Export:** Click "Download Report" to generate a snapshot of the current system state.

## 💻 Tech Stack

* **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3 (Glassmorphism UI).
* **Visualization:** [Chart.js](https://www.chartjs.org/) (Customized for oscilloscope visuals).
* **Reporting:** [jsPDF](https://github.com/parallax/jsPDF) (Client-side PDF generation).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open an issue for any bugs you find.

---
*Developed by [Utsav Shresth]*
