# Vehicle Dashboard Webapp

Desktop webapp for viewing vehicles from PocketBase. Built with Next.js.

## Features

- **List View** – Grid of vehicle cards with thumbnails, status, and details
- **Dock View** – Vehicles grouped by assigned dock (1–6)
- **Search** – Filter by vehicle number, customer, driver, type
- **Filters** – All, Inward, Outward
- **Dock Layout** – Left sidebar navigation with main content area

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure PocketBase URL. Copy `.env.local.example` to `.env.local`:

   ```bash
   cp .env.local.example .env.local
   ```

   Set `NEXT_PUBLIC_POCKETBASE_URL` to your PocketBase instance (e.g. `https://pocketbase.intoship.cloud` or `http://127.0.0.1:8090`).

3. Run the dev server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

## PocketBase

Expects a `vehicles` collection with fields such as:

- `vehicleno`, `image`, `Type`, `Transport`, `Customer`, `Driver_Name`, `Contact_No`
- `Check_In_Date`, `Check_Out_Date`, `Assigned_Dock`
- `Dock_In_DateTime`, `Dock_Out_DateTime`, `Remarks`
