# WealthTrackPro

## About
**WealthTrackPro** is a smart personal wealth management and financial planning web application. It enables users to track multi-asset investment portfolios, set and simulate financial goals, monitor live market data, receive automated portfolio rebalancing suggestions based on risk profile, and plan future investments using interactive financial calculators.

---

## Features
- **User Registration and Login:** Secure email/password authentication with encrypted password storage.
- **Google Authentication:** Seamless one-click sign-in using Google OAuth 2.0.
- **Profile and Risk Profile:** Customizable risk tolerance profiles (*Conservative*, *Moderate*, *Aggressive*).
- **KYC Status:** Integrated KYC verification status tracking (*Pending*, *Verified*, *Rejected*).
- **Financial Goals:** Create, track, and manage short-term and long-term financial milestones.
- **What-if Goal Simulation:** Interactive scenario planning to test monthly contribution and return rate impacts.
- **Portfolio Holdings:** Real-time tracking of Stocks, ETFs, Mutual Funds, Bonds, and Cash with gain/loss metrics.
- **BUY/SELL Transactions:** Transaction management with automatic weighted average cost calculation and holding synchronization.
- **Market Data:** Live price updates and ticker search powered by Yahoo Finance (`yfinance`).
- **AI Portfolio Rebalancing:** Algorithmic drift detection with risk-adjusted asset allocation recommendations.
- **Notifications:** Real-time updates and milestone alerts via Server-Sent Events (SSE).
- **Dashboard:** Unified financial summary with portfolio KPI metrics, asset allocation donut charts, and recent activity.
- **SIP Calculator:** Systematic Investment Plan compounding growth projections with detailed schedules.
- **Retirement Planner:** Inflation-adjusted retirement corpus forecasting and monthly savings gap analysis.
- **Loan Payoff Calculator:** Loan EMI calculations with prepayment amortization schedules.
- **PDF Wealth Report:** Download comprehensive, formatted client-ready PDF wealth summaries.
- **Dark/Light Mode:** System and user-toggleable theme preferences with persistent state.
- **Responsive Design:** Mobile-friendly, modern interface optimized for desktop, tablet, and mobile screens.

---

## Tech Stack

### Frontend
- **React (v18)** — Modern component-based user interface
- **JavaScript (ES6+)** — Application logic
- **Vite** — Fast frontend build tool and dev server
- **Tailwind CSS** — Utility-first responsive styling
- **Chart.js & react-chartjs-2** — Interactive portfolio and goal charts
- **jsPDF & jspdf-autotable** — Client-side PDF generation
- **Axios** — REST API client communication

### Backend
- **Python (3.10+)** — Core backend runtime
- **FastAPI** — High-performance asynchronous REST API framework
- **SQLAlchemy** — ORM for relational database modeling
- **PostgreSQL** — Robust relational database management system
- **yfinance** — Live market price data integration
- **python-jose & passlib** — JWT token handling and bcrypt password hashing
- **Alembic** — Database migrations

---

## Project Modules

### 1. User Management
Handles user registration, login, JWT token authentication, Google OAuth 2.0 integration, user profile updates, risk tolerance profiling, and KYC status tracking.

### 2. Financial Goals
Enables creation, editing, and deletion of financial targets. Provides real-time progress calculations and what-if simulation models to project future goal completion.

### 3. Portfolio & Transactions
Tracks multi-asset holdings (Stocks, ETFs, Mutual Funds, Bonds, Cash) and executes BUY/SELL transactions with automated holding synchronization and weighted average cost adjustments.

### 4. Market Data & AI Rebalancing
Integrates live market quotes using Yahoo Finance and evaluates current portfolio asset allocation against the user's risk profile to provide actionable rebalancing recommendations.

### 5. Dashboard & Reports
Aggregates key financial metrics, visual asset breakdown charts, live notification feeds, and generates downloadable multi-page PDF wealth reports.

### 6. Financial Calculators
Provides standalone financial planning tools including a Systematic Investment Plan (SIP) calculator, an inflation-adjusted Retirement Planner, and a Loan Payoff / EMI calculator.

---

## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- PostgreSQL database

---

### Backend Setup

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables in `backend/.env`:
   ```env
   PROJECT_NAME="Wealth Management API"
   SECRET_KEY="your_jwt_secret_key"
   DATABASE_URL="postgresql://username:password@localhost:5432/wealth_db"
   GOOGLE_CLIENT_ID="your_google_client_id"
   GOOGLE_CLIENT_SECRET="your_google_client_secret"
   GOOGLE_REDIRECT_URI="http://127.0.0.1:8000/api/v1/auth/google/callback"
   FRONTEND_URL="http://localhost:5173"
   ```

5. Start the FastAPI server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   API will be running at `http://127.0.0.1:8000` (Swagger docs at `http://127.0.0.1:8000/docs`).

---

### Frontend Setup

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install frontend dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:8000
   VITE_GOOGLE_CLIENT_ID=your_google_client_id
   ```

4. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser to view the application.

---

## License
This project is licensed under the MIT License.
