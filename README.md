# Neyway Express

Captain Crumb’s Parcel Dash is a mobile-friendly parcel sorting game with 10 levels, a relaxed solo mode, a timed solo mode, same-device turns, and **online PvP**.

## Online PvP: how to play

1. Open the live game on your device and choose **Online PvP**.
2. Tap **Create a room** and share the five-letter room code or invite link with your friend.
3. Your friend opens the link (or chooses Online PvP and enters the code), then taps **Join**.
4. When the host sees that the friend joined, tap **Start match**. Both players sort the same parcel pile at the same time. Live score and parcel progress are shared; the winner is shown when both players finish or the timer ends.

Both players need the online service URL. GitHub Pages can host the solo game files, but it cannot run the realtime multiplayer server by itself.

## Deploy the online game

This repo includes a Render Blueprint in `render.yaml`. Connect the GitHub repository to Render and create a Blueprint instance from that file. It provisions a free Node web service that serves the game page and handles room codes and WebSocket updates from the same URL. Once deployment finishes, open the service's `onrender.com` URL and share that link with players. No database, player account, or install is required.

Render's free web services may go to sleep when idle, so the first visit after a quiet period can take a little time to wake up. Room data lives in server memory; a server restart ends any active rooms.

## Run on your computer

Requires Node.js 20 or newer.

```sh
npm install
npm start
```

Then open `http://localhost:3000`. For remote play, both players must use the deployed service URL; localhost is only reachable on your own computer.

## Game controls

- Choose a destination by tapping a station (or pressing 1, 2, or 3).
- Wrap fragile parcels before sorting them. Use **Show me** for a hint and **Pause** to take a break.
- Clean streaks increase points; fast express deliveries earn a bonus.
- Solo progress is stored in this browser. Online rooms are temporary and are not saved after the server restarts.
