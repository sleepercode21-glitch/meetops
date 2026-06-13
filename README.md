# MeetOps / TechUp Scheduler

MeetOps is a lightweight session coordination tool for private developer communities. It helps groups create sessions, collect member availability, run polls, choose final timings, and generate Google Meet links without repeatedly coordinating everything through chat.

The app is currently built for the TechUp Programmers group MVP.

## Product Goal

The goal is simple:

1. Members join a private group.
2. A host creates a session.
3. Members vote on availability, topics, or final timing.
4. The host finalizes the session.
5. The app creates or displays the scheduled session details and Google Meet link.

This is not meant to be a large event management platform. The MVP focuses only on reducing manual coordination for community learning sessions.

## Core Features

### Google Login

Users sign in with Google OAuth.

Because the OAuth app is currently in testing mode, only manually added test users can access the app. Users who want access need to send their Gmail ID to the app owner/admin.

### Private Groups

Users can join private groups using invite links or invite codes.

Each group contains:

* Members
* Hosts
* Sessions
* Polls
* Scheduled session details

### Session Hosting

Any allowed group member can create a session.

A session can include:

* Title
* Description
* Host
* Status
* Polls
* Scheduled time
* Google Meet link

Example sessions:

* DSA Practice: Graphs
* System Design Discussion
* Resume Review Session
* Backend API Design Walkthrough

### Polls

The app supports session-level polls.

Main poll types:

* Availability poll
* Final timing poll
* Topic poll
* Interest poll

For MVP, the most important flow is availability polling and final timing voting.

### Availability Polling

Availability polls help the host collect possible time slots from members.

Members can select multiple times that work for them.

Example:

* Friday 7:00 PM – 8:00 PM
* Saturday 11:00 AM – 12:00 PM
* Sunday 6:00 PM – 7:00 PM

Availability polls do not schedule the session directly. They only help the host understand when people are free.

### Final Timing Poll

After reviewing availability results, the host can create a final timing poll.

Members choose one final time.

The final timing poll is the poll that decides the actual session time.

### Google Meet / Calendar Integration

The app is designed to support Google Calendar and Google Meet scheduling.

The session host and meeting owner can be different people. This is useful when the group wants to use a specific admin or premium Google account to create longer Google Meet sessions.

## Current Status

The MVP is mostly complete.

Working or planned MVP flow:

* Google login
* Group access
* Session creation
* Poll creation
* Availability voting
* Final timing voting
* Scheduled session flow
* Google OAuth / Calendar integration

Remaining work:

* OAuth production verification
* Domain setup for Google OAuth branding verification
* UI polish
* Small bug fixes based on testing

## OAuth Access Note

The app currently uses Google OAuth in testing mode.

Because of this, users must be manually added as test users before they can log in.

To get access, send your Gmail ID to the app owner/admin.

Once the app has a proper verified domain and Google OAuth approval, access can be opened more broadly.

## Tech Stack

Typical stack:

* Frontend: Next.js / React
* Styling: Tailwind CSS
* Auth: Google OAuth
* Database: PostgreSQL
* ORM / DB layer: Prisma or SQL-based access layer
* Hosting: Vercel
* Scheduling integration: Google Calendar / Google Meet

## Local Development

Clone the repository:

```bash
git clone <repo-url>
cd <repo-name>
```

Install dependencies:

```bash
npm install
```

Create environment variables:

```bash
cp .env.example .env
```

Required environment variables may include:

```env
DATABASE_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
```

Run database migrations:

```bash
npm run db:migrate
```

Seed development data if available:

```bash
npm run db:seed
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Important Product Rules

Availability polls collect possible times. They do not schedule the session.

Final timing polls choose the actual session time.

Only final timing polls should trigger scheduling.

Suggestions are not voteable options unless the host manually adds them as official poll options.

Google tokens should never be exposed to the frontend.

All protected actions must be checked on the backend.

Regular members can vote and view sessions.

Hosts and admins can create sessions, create polls, close polls, and finalize timing.

## MVP Non-Goals

Do not build these for the MVP:

* WhatsApp automation
* SMS reminders
* Email reminder system
* Notification inbox
* Calendar availability sync
* Reading members’ Google Calendars
* Attendance tracking
* Recurring sessions
* Advanced analytics dashboard
* AI topic recommendations

## Deployment

The app is currently deployed on Vercel:

```text
https://meetops-gilt.vercel.app/
```

For production OAuth verification, the app should eventually move to a custom domain.

Example:

```text
https://meetops.yourdomain.com
```

Public pages required for OAuth verification:

```text
/privacy
/terms
```

The OAuth app name should match the product name shown on the homepage.
