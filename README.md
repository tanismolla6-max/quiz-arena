# Quiz Arena — Real-time multiplayer quiz website

A full-stack browser game built with React, Vite, Express, and Socket.IO. It uses a server-authoritative timer and scoring, six-character room codes, shareable invite links, a lobby, multiple-choice questions, a live leaderboard, and end-of-game rankings.

## Included features
- Create a room and get a unique six-character code.
- Join from another browser/device using the code or `?room=CODE` invite link.
- Lobby with player list and host badge; host can start the quiz.
- 10 randomized questions from a built-in question bank.
- 15-second synchronized question timer.
- One locked answer per player per question.
- Server-side correctness checking and speed bonus (500–1,000 points).
- Live answered count and leaderboard updates.
- Host handoff if the host disconnects; room is removed when everyone leaves.
- Final podium and play-again flow.
- Responsive layout for mobile and desktop.

## Run locally
Requires Node.js 20+ and npm.

1. Open a terminal in the project folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create environment files:
   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```
4. Start the frontend and backend:
   ```bash
   npm run dev
   ```
5. Open the Vite URL shown in the terminal (usually `http://localhost:5173`).
6. To test multiplayer locally, open a second browser or an incognito window. To test across devices on the same network, set `VITE_SERVER_URL` to the computer's LAN IP and configure the server CORS origin accordingly.

## Deploy it publicly
You need to deploy both the frontend and the Socket.IO backend. This source code is ready for that, but it is not automatically hosted by downloading it.

### 1. Deploy the server (for example, Render)
- Create a new Web Service from this repository.
- Root directory: `server` (or use the monorepo commands below).
- Build command: `npm install`
- Start command: `npm start`
- Environment variables:
  - `CLIENT_ORIGIN=https://YOUR-FRONTEND-DOMAIN`
  - `PORT` is normally provided by the host; the code defaults to 3001 locally.
- Copy the deployed server base URL, e.g. `https://your-quiz-server.example.com`.
- Verify `https://YOUR-SERVER/health` returns `{ "ok": true, ... }`.

### 2. Deploy the frontend (for example, Vercel)
- Import the repository.
- Set the project/root directory to `client`.
- Build command: `npm run build`
- Output directory: `dist`
- Add environment variable `VITE_SERVER_URL=https://YOUR-DEPLOYED-SERVER`.
- Deploy, then set the server's `CLIENT_ORIGIN` to the final frontend URL and redeploy/restart the server.

### Monorepo deployment alternative
If your host builds from the repository root, install dependencies from the root and start the server with `npm run start -w server`. For the frontend, build from root using `npm run build -w client` and serve `client/dist` as static files.

## Important production notes
- Room state is currently held in server memory. It is suitable for a small single-instance game server, but active rooms reset when the server restarts and do not synchronize across multiple server instances. For scale, use a shared Socket.IO adapter (such as Redis) and persistent storage if you need durable history.
- This MVP does not require accounts or collect email addresses. Nicknames are temporary and room-scoped.
- For a public launch, consider rate limiting, abuse reporting, moderation controls, and server-side input validation appropriate to your audience.
- Do not deploy multiple server replicas without adding shared room state and a Socket.IO adapter.

## Project layout
```
client/   React/Vite UI and responsive styles
server/   Express health endpoint and Socket.IO game engine
```
