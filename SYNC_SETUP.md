# OkHabit - Supabase Sync Setup Guide

This guide explains how to set up cloud sync for OkHabit using Supabase, enabling secure backup and multi-device sync while maintaining full offline functionality.

## Overview

OkHabit uses an **offline-first** architecture:
- All data is stored locally in IndexedDB (using Dexie)
- Works perfectly without internet or cloud configuration
- When Supabase is configured, data automatically syncs bidirectionally
- Syncs happen every 30 seconds, when online, and when app becomes visible
- Uses Last-Write-Wins conflict resolution

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up/sign in
2. Click "New Project"
3. Fill in your project details:
   - **Name**: OkHabit (or your preferred name)
   - **Database Password**: Choose a strong password
   - **Region**: Select the closest region to you
4. Wait for the project to be created (~2 minutes)

### 2. Run the Database Schema

1. In your Supabase dashboard, go to the **SQL Editor** (left sidebar)
2. Click **New Query**
3. Copy the entire contents of `app/supabase-schema.sql` from this repository
4. Paste it into the SQL editor
5. Click **Run** (or press Cmd/Ctrl + Enter)
6. You should see "Success. No rows returned" - this means all tables were created!

### 3. Configure Your App

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy your **Project URL** and **publishable** API key (labeled as "anon public")
3. Create a `.env` file in the `app/` directory:

```bash
cd app
cp .env.example .env
```

4. Edit `.env` and add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

5. Restart your development server:

```bash
pnpm dev
```

### 4. Create an Account & Sign In

1. Open your app - you'll see a cloud sync icon in the bottom right
2. Click the **sign in icon** (arrow)
3. Enter your email and password, then click **Sign Up**
4. Check your email for the confirmation link
5. Click the confirmation link
6. Return to the app and sign in with your credentials

**That's it!** Your data will now automatically sync to the cloud.

## Features

### Automatic Sync
- Syncs every 30 seconds when online and authenticated
- Syncs immediately when you come back online
- Syncs when app becomes visible (useful for mobile/PWA)

### Sync Status Indicator
Located in the bottom-right corner:
- 🟢 **Green cloud**: Successfully synced
- 🔄 **Spinning arrows**: Currently syncing
- 🔴 **Red alert**: Sync error (click for details)
- 📴 **Cloud off**: Offline mode
- Last sync time displayed

### Manual Sync
Click the sync status to trigger an immediate sync.

### Offline Mode
The app works perfectly offline:
- All features available without internet
- Changes are queued and synced when you reconnect
- No data loss

## Data Safety

### Conflict Resolution
If the same record is edited on multiple devices:
- **Last-Write-Wins**: The most recently updated version is kept
- Updates are atomic per-record
- Deletions (soft deletes) are synced properly

### Security
- All data is tied to your user account via Row Level Security (RLS)
- You can only see and modify your own data
- API keys are safe to expose (they're meant to be public)
- Your password is never stored in the app

### Backup Strategy
1. **Local**: Data is stored in browser IndexedDB (persistent storage requested)
2. **Cloud**: Data synced to Supabase PostgreSQL database
3. **Manual Export**: Use the backup feature in Settings (if implemented)

## Troubleshooting

### Sync not working?
1. Check you're signed in (look for sign-in icon)
2. Check you're online (look for cloud-off icon)
3. Check browser console for errors
4. Try signing out and back in
5. Verify `.env` credentials are correct

### Data not appearing?
1. Each account has separate data (by design for privacy)
2. If you signed up with a different email, your data is under that account
3. Use the same email on all devices to see the same data

### Lost local data?
If you cleared browser data:
1. Sign in to your account
2. Data will be pulled from Supabase automatically
3. Local database will be restored

### Starting fresh?
To start with a clean slate:
1. Sign out (if signed in)
2. Open browser DevTools → Application → Storage → Clear site data
3. Optionally: Delete your data from Supabase dashboard → Table Editor

## Optional: Running Without Supabase

The app works perfectly without Supabase:
1. Don't create a `.env` file (or leave it empty)
2. App runs in offline-only mode
3. No sync icon appears
4. All data stays local to your device

## Deployment Considerations

When deploying to production:

1. **Environment Variables**: Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in your hosting platform (Vercel, Netlify, etc.)

2. **PWA Setup**: The app uses `vite-plugin-pwa` for offline support - make sure service worker is properly configured

3. **HTTPS Required**: Supabase auth requires HTTPS (except localhost)

## Advanced: Sync Customization

Edit `app/src/lib/sync.ts` to customize:
- Sync interval (default: 30 seconds)
- Conflict resolution strategy
- Tables to sync
- Retry logic

Edit `app/src/main.tsx` to change when sync starts.

## Database Schema Updates

If you add new tables or fields:
1. Update `app/src/lib/db/types.ts` (TypeScript types)
2. Update `app/src/lib/db/index.ts` (Dexie schema)
3. Update `app/supabase-schema.sql` (Supabase schema)
4. Run new SQL in Supabase dashboard
5. Bump Dexie version number and add migration

## Support

- Check browser console for detailed error messages
- Supabase logs: Dashboard → Logs
- Database queries: Dashboard → Table Editor

---

**Important**: Keep your `.env` file out of version control (it's in `.gitignore` by default). Never share your database password publicly.
