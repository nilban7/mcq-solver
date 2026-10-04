# ⚡ Instant One-Tap Remote Webcam MCQ Solver

A private, lightweight web application designed for teachers and educators to solve multiple-choice questions (MCQs) displayed on a laptop screen using a mobile phone as a hands-free camera and a desktop PC monitor as the solver hub and remote shutter.

---

## 📐 Physical Exam Architecture

```text
              LAPTOP
       ┌───────────────────┐
       │                   │
       │   MCQ QUESTION    │
       │                   │
       │   Q. ............ │
       │   A. ............ │
       │   B. ............ │
       │   C. ............ │
       │   D. ............ │
       │                   │
       └─────────┬─────────┘
                 │
                 │ Photographed by
                 ▼
              📱 PHONE
          [ Continuous Camera ]
          (Facing laptop screen)
                 │
                 │ 1 snapshot uploaded on trigger
                 ▼
          🖥️ DESKTOP MONITOR
      ╔═════════════════════════════╗
      ║      [ 📸 CLICK PHOTO ]     ║  ◀── Spacebar / Click Shutter
      ║                             ║
      ║       CORRECT ANSWER:       ║
      ║              C              ║  ◀── Giant Verified Answer
      ║         ✓ VERIFIED          ║
      ║       Confidence: 98%       ║
      ║   ⚡ Groq Key #1 (Qwen 3.8) ║
      ╚═════════════════════════════╝
```

---

## 🌟 Key Features

1. **Remote Desktop Shutter**:
   - Tap `[ 📸 CLICK PHOTO ]` or press `Spacebar` on the desktop PC.
   - The phone camera instantly takes a high-res photo, uploads it, and remains open for the next question.
2. **Continuous Phone Camera with Wake-Lock**:
   - Prop the phone up facing the laptop screen once.
   - Screen wake-lock prevents the phone from sleeping. You never need to touch the phone during the exam.
3. **3-Tier Multi-Key Auto-Failover (100% Free)**:
   - **Groq Key #1** (Primary: `qwen/qwen3.8-27b`, 1,000 RPM & 250k TPM free).
   - **Groq Key #2** (Backup: auto-switches in < 1s if Key 1 hits rate-limits or quota).
   - **Gemini Key** (Emergency Backup #3: automatically activates if both Groq keys fail).
   - Automatic 60-second cooldown recovery.
4. **Persistent Big Answer Display**:
   - Giant high-visibility answer card (`A`, `B`, `C`, `D`) remains permanently on screen until the next photo is taken.
   - Dual-pass verification badge, confidence score, full question/options breakdown, and concise explanation.
5. **Calm & Quiet Exam Mode**:
   - Zero distracting confetti or cheer bursts on answer display.
6. **IndexedDB History & Multi-Format Export**:
   - All solved MCQs auto-saved locally in browser storage.
   - Export answer keys to **CSV**, **Excel (XLSX)**, and formatted **PDF**.
7. **Zero Continuous Video Streaming**:
   - Consumes negligible bandwidth (~200 KB per photo). Entire 100-question exam uses < 25 MB.

---

## 🚀 Running on Your Desktop PC

### 1. Prerequisites
- **Node.js** (v18 or higher recommended)
- **Git**

### 2. Download / Clone the Repository
```bash
git clone <YOUR-GITHUB-REPO-URL>
cd mcq-solver
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Start the Application
```bash
npm run dev:all
```
*(Starts both backend API on port 3001 and frontend with SSL on port 3000)*

### 5. Open on Desktop Browser
Navigate to:
```text
https://localhost:3000
```
*(Accept the self-signed SSL warning if prompted: click Advanced -> Proceed)*

### 6. Configure Your AI Keys (Once)
1. Click the **⚙️ Settings** icon (or the **AI Engine** badge at the top).
2. Enter your keys:
   - **Groq Key #1 (Primary)**: [`console.groq.com/keys`](https://console.groq.com/keys)
   - **Groq Key #2 (Backup)**: Second key from another account/project (optional)
   - **Google Gemini Key (Emergency Backup #3)**: [`aistudio.google.com/app/apikey`](https://aistudio.google.com/app/apikey)
3. Click **Save Configuration**.
*(Keys are stored securely in browser local storage and never exposed).*

### 7. Connect Phone Camera
1. Click **CREATE SESSION** on your desktop screen.
2. Scan the displayed QR code with your phone camera.
3. Tap **ALLOW CAMERA** and prop the phone facing the laptop screen.
4. Tap **[ 📸 CLICK PHOTO ]** (or press `Spacebar`) on your desktop monitor!

---

## 🧪 Testing

To run the automated Vitest test suite:
```bash
npm test
```

To build for production:
```bash
npm run build
```
