# EduMeal Portal 🍲🏫
**Smart Mid-day Meal Compliance, Waste Reduction & Feedback System**

EduMeal Portal is a professional, full-stack, enterprise-grade digital compliance system meticulously designed to digitize and track the **AP Mid-Day Meal Scheme (MDMS)** program. It bridges the gap between students, educators, and dietary supervisors to streamline attendance tracking, analyze nutrient-dense feedback, optimize daily food production, and systematically combat food wastage.

---

## 🚀 Key Functional Modules

[Deployed Application](https://edu-meal-portal.vercel.app/)

The application operates as a unified hub dividing clearance levels into four authority-specific portals, all bound by secure cloud integrations:

### 1. 🧑‍🏫 Teacher Portal (Daily Attendance & Marking)
*   **Rapid Roll Marking**: Interactive roll panel for marking student presence/absence.
*   **Live Registrar & Summary**: Real-time counter of total enrolled vs. current present counts.
*   **Submission Overwrite Safety**:
    *   Once a roster's attendance is submitted, entering changes prompts checking flags: *"Already attendance is submitted and do you want to change or cancel?"*.
    *   **Cancel Safe Revert**: Choosing to cancel discards all real-time changes instantly, safely reverting states back to the last posted configuration without mutating the database or cloud state.
*   **Registry Roster Management**: Supports additions, modifications, and deletions of master records right from the class lists.

### 2. 👧 Student Portal (Feedback & Rating)
*   **Interactive Meal Audits**: Simple, accessible interface for students to vote on daily culinary performance, rating menu quality, taste, and quantity.
*   **Comment Panel**: Simple, honest sharing on likes, dislikes, and dietary recommendations.

### 3. 🔎 Supervisor Portal (Compliance & Analytics)
*   **Daily Postings Review**: Live table view mapping the attendance posting status across all sections.
*   **Wastage Audits**: Dedicated workspace to report daily food production metrics vs. actual consumed and subsequent leftovers (kg).
*   **Analytical Dashboards**: Beautiful, dynamic Recharts visuals compiling consumption patterns, popular dishes, and wastage charts.

### 4. ⚙️ Admin Portal (Systems Config)
*   **Master Registers**: System controls to configure master classes, standard sections, menu lists, and authorized access.

---

## 🛠️ Technology Stack

*   **Frontend Library**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) (for type-safe data pipelines)
*   **Build Bundler**: [Vite](https://vite.dev/) (blazing-fast compiles and asset pipelines)
*   **Styling Engine**: [Tailwind CSS](https://tailwindcss.com/) (modern responsive panels with sleek typography pairings)
*   **Animations**: [Motion](https://motion.dev/) (crisp micro-interactions, responsive list fades and modals)
*   **Database & Sync**: [Firebase Firestore](https://firebase.google.com/docs/firestore) (dynamic real-time cloud store persistence)
*   **Data Visualization**: [Recharts](https://recharts.org/) (fluid analytics charts and graphs)
*   **Iconography**: [Lucide React](https://lucide.dev/) (modern pixel-perfect UI vectors)

---

## 📂 Project Directory Structure

```text
├── src/
│   ├── components/            # Portal Specific Components
│   │   ├── WelcomePortal.tsx  # Landing, portal switching & Profile selection
│   │   ├── TeacherPortal.tsx  # Attendance rolls, rollback buffers, registry management
│   │   ├── StudentPortal.tsx  # Dynamic meal feedback boards
│   │   ├── SupervisorPortal.tsx # Wastage telemetry, analytics charts & live status maps
│   │   └── AdminPortal.tsx    # Global options, system-wide registries
│   ├── services/              # Infrastructure & State Management
│   │   ├── db.ts              # Real-time Firestore query pipelines & mutators
│   │   └── auth.ts            # Basic authentication abstractions
│   ├── types.ts               # Shared TypeScript schemas, interfaces, & contracts
│   ├── firebase.ts            # Firestore client SDK initialization
│   ├── index.css              # Global styles & Tailwind configuration
│   └── main.tsx               # Primary application entry assembly
├── firestore.rules            # Firestore security schemas
├── package.json               # Package manifests and dependency controls
└── tsconfig.json              # TypeScript engine configurations
```

---

## 📋 Prerequisites & Configuration

Before launching the portal, make sure you configure your database variables:

### Environment Variables
Create a `.env` file at the root level of your project and assign your Firebase configuration coordinates:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
VITE_FIREBASE_PROJECT_ID=your_project_id_here
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
VITE_FIREBASE_APP_ID=your_app_id_here
```

---

## 💻 Getting Started

Follow these steps to run the application locally on your computer:

### 1. Install Dependencies
```bash
npm install
```

### 2. Launch Local Development Server
```bash
npm run dev
```
This builds and serves the application locally, by default listening at `http://localhost:3000`.

### 3. Compile Production Bundle
To create a optimized static production-ready build:
```bash
npm run build
```
Production assets will be outputted directly inside the `dist/` directory.

### 4. Code Quality & Formatting
Run the TypeScript compiler to check for static typing issues:
```bash
npm run lint
```

---

## 🔥 Firebase Security Rules

To ensure complete, uncompromised real-time data flow with Firestore, refer to security rules (`firestore.rules`):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // Custom operational profiles mapped under portal logic
    }
  }
}
```

---

## ✨ Features In Depth: Editable Attendance & Safe Cancel Revert
*When a teacher updates today's attendance roll after it has already been submitted:*
1. Clicking **Submit Attendance Roll** checks if today's date + class combo has already been recorded.
2. If true, the system prevents sudden overwrites and triggers a prompt: **Already attendance is submitted and do you want to change or cancel?**.
3. **If Yes / Proceed**: The updated statuses are committed to firestore, updating supervisor portals and feedback indices immediately.
4. **If Cancel**: The system invokes a local rollback handler, automatically scanning the exact student state snapshot cached upon initial portal loading. Every single student's `present` marker and the visual checkboxes revert to their previous correct values, fully maintaining strict operational safety.

---

## 📄 License
This compliance portal is licensed under the MIT License.
