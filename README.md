# LeadPulse 🗺️ Google Maps Leads Scraper & Social Finder

Turn Google Maps searches into high-converting, enriched business lead lists with **verified contact details, phone numbers, direct WhatsApp links, Instagram profiles, Facebook pages, LinkedIn handles, and websites**.

---

## 🌟 Key Features

- **Multi-Source Contact & Social Discovery**:
  - Automatically extracts phone numbers and addresses from Google Maps.
  - Crawls business websites and web search engines for **Instagram**, **Facebook**, **LinkedIn**, and **direct emails** (`info@`, `contact@`, etc.).
  - 1-Tap **WhatsApp Direct Chat** (`wa.me/1...`) for US and international numbers without needing to save contacts.
- **🔥 "NO WEBSITE" Pitch Indicator**:
  - Automatically identifies local businesses that have no website—the highest-converting target for freelance web design and booking funnels ($1,500–$3,500).
- **High-Ticket US Niches Presets**:
  - 1-Click quick presets for:
    - 🌴 **Miami Med Spas**
    - 🦷 **Austin Dentists**
    - 🏥 **Dallas Clinics**
    - ✨ **LA Aesthetics**
    - 🔨 **Tampa Roofers**
- **Real-Time Streaming Web UI**:
  - Live progress bar, metrics KPI dashboard, and interactive table streaming leads via Server-Sent Events (SSE).
- **Instant Multi-Format Exports**:
  - Formatted **Excel (.xlsx)** with auto-proportioned columns.
  - Clean **CSV** (UTF-8 with Excel BOM).
  - Raw **JSON** export & 1-click **Copy All Emails**.
- **Ready for Cloud Deployment**:
  - Includes a production `Dockerfile` compatible with Render, Railway, Fly.io, or any VPS.

---

## 🚀 Local Quick Start

### 1. Install & Run
```bash
git clone https://github.com/aaravv-debug/buisnesss-leads-finder.git
cd buisnesss-leads-finder
npm install
npm start
```

Open your browser to:
👉 **http://localhost:3000**

---

## ☁️ Cloud Deployment (Render / Railway / VPS)

### Option A: Render (Easiest)
1. Push this repository to GitHub.
2. Go to [render.com](https://render.com) and create a **New Web Service**.
3. Select your GitHub repository.
4. Set Environment to **Docker** (Render will automatically detect the included `Dockerfile`).
5. Choose Free or Starter plan, and click **Deploy**!

### Option B: Railway
1. Open [railway.app](https://railway.app) and create a **New Project**.
2. Select **Deploy from GitHub repo**.
3. Railway will detect `Dockerfile`, build Google Chrome, and deploy your live URL.

### Option C: Docker (Self-Hosted VPS)
```bash
# Build Docker image
docker build -t leadpulse-scraper .

# Run container on port 3000
docker run -d -p 3000:3000 --name leads-app leadpulse-scraper
```

---

## 📊 Extracted Data Columns

| Column | Source | Description |
|---|---|---|
| **Business Name** | Google Maps | Official name of the business |
| **Category** | Google Maps | Business category (Dentist, Med Spa, etc.) |
| **Rating & Reviews** | Google Maps | Average stars & review count |
| **Phone** | Google Maps | Cleaned phone number |
| **WhatsApp Link** | Generated | 1-Tap `wa.me/1...` direct chat link |
| **Emails** | Website / Web Search | Direct inbox emails |
| **Instagram** | Website / Web Search | Direct profile or 1-click search |
| **Facebook** | Website / Web Search | Direct page or 1-click search |
| **LinkedIn** | Website / Web Search | Company or founder profile |
| **Website & Pitch**| Google Maps | Website link or `🔥 NO WEBSITE` hot pitch tag |
| **Address** | Google Maps | Full street address, city, state, zip |

---

## 💻 Tech Stack

- **Backend**: Node.js, Express, Puppeteer-Core, Axios, Cheerio, XLSX
- **Frontend**: Vanilla HTML5, CSS3 Glassmorphism, Modern JavaScript (SSE client)
- **Deployment**: Docker, Google Chrome Linux
