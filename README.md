# Worksphere — Hierarchical RBAC Work Portal

Worksphere is an enterprise-grade, hierarchical Role-Based Access Control (RBAC) portal featuring a dynamic, role-differentiated UI/UX theme system and a secure, partitioned simulated developer mailbox drawer.

---

## 🎨 Role-Differentiated User Interface

Worksphere completely adapts its visual identity, transitions, and layout depending on the authenticated user's tier:

*   **Super Admin Portal (Command Center)**: A futuristic, cybernetic, Jarvis-inspired dark void theme utilizing neon cyan/violet glowing borders, an animated conic-gradient rotating avatar ring, scanline headers, and monospace code font configurations.
*   **Admin Portal (Operations Dashboard)**: A modern, professional dark-slate corporate theme featuring slate cards, Indigo accents, flat layout borders, and alternating table rows for readability.
*   **User Portal (Employee Workspace)**: A clean, minimal Notion/Stripe-inspired light theme showcasing off-white backgrounds, white card panels, extra-rounded corners, and friendly Inter typography.

---

## 📧 Partitioned Simulated Mailbox

The developer simulated mailbox drawer simulates outgoing SMTP server notifications (welcomes and password OTP resets) and respects session authorizations:

*   **Super Admin**: Has total insight. Can view and clear all outgoing emails.
*   **Admin**: Can view and clear emails sent to themselves or to users with the `user` role.
*   **User**: Can only view and clear emails sent to their own email address.
*   **Logged Out**: The mailbox automatically detects the email address typed in the active form inputs (login, signup, or reset OTP screens) to safely show only their specific messages.

---

## 🏗️ Architecture & Stack

```
   [🌐 Browser (Port 8088)]
             │
             ▼
     [nginx Reverse Proxy] (task2-frontend)
      ├── /api/*  ──▶ [Express Backend] (task2-backend:5050)
      │                     │
      │                  (Prisma)
      │                     ▼
      │             [PostgreSQL 16] (task2-postgres-db:5433)
      │
      └── Static  ──▶ Static asset server
```

*   **Frontend**: Vanilla HTML5, CSS3 Custom Properties (CSS variables), Vanilla JavaScript, Google Fonts (Outfit, Inter, JetBrains Mono), Font Awesome.
*   **Backend**: Node.js + Express REST API.
*   **ORM**: Prisma Client.
*   **Database**: PostgreSQL 16.
*   **Proxy / Server**: Nginx (handling API reverse routing).
*   **Containers**: Docker Compose (multi-container cluster).

---

## 🔑 Default Accounts

| Role | Email | Password | Theme Style |
| :--- | :--- | :--- | :--- |
| 🔴 **Super Admin** | `superadmin@office.com` | `SuperAdmin123!` | Cybernetic (Neon/Mesh) |
| 🟣 **Admin** | `admin@office.com` | `Admin123!` | Slate/Indigo Professional |
| 🔵 **User** | `user@office.com` | `User123!` | Notion/Stripe Light |

---

## 🚀 Quick Start (Docker Compose)

Ensure you have Docker and Docker Compose installed on your system, then run:

```bash
# Clone the repository and enter the directory
cd Worksphere

# Build and start all 3 containerized services in the background
docker-compose up --build -d
```

Once starting successfully, access the application in your browser at:
👉 **[http://localhost:8088](http://localhost:8088)**

---

## 🛠️ Docker Commands Guide

```bash
# Check the status of your running services
docker ps --filter "name=task2"

# View live streaming log outputs for the API backend
docker logs task2-backend -f

# Run database migrations manually via Prisma inside the backend container
docker exec -it task2-backend npx prisma db push

# Stop and remove all containers and network structures
docker-compose down
```