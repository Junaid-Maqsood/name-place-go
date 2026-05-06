# 🎮 Name Place Go! (Multiplayer Game)
**Game link:** https://name-place-go-play.lovable.app

A fun, fast-paced multiplayer browser game inspired by the classic **“Name Place Animal Thing”**. Built with a modern full-stack setup using Lovable, TanStack, Supabase, and Cloudflare.

---

## 🚀 Features

* 👥 Multiplayer lobby (up to 10 players)
* 🔑 Join via 6-character Game ID or invite link
* 🧑‍💼 Game creator becomes admin
* 🎯 Custom categories (e.g. Country, Movie, Food)
* ⏱️ Configurable round timers
* ⚡ Final countdown when a player finishes early
* ✅ Smart answer validation (via Supabase functions)
* 🧠 Duplicate detection & scoring system
* 🏆 Leaderboard with top 3 winners
* 🎭 Fun player titles based on performance
* 💬 Live chat system
* 🎨 Playful UI inspired by Skribbl.io
* 🌙 Dark mode support
* 🎉 Animations & effects (confetti, motion)

---

## 🛠️ Tech Stack

### Frontend

* React 19
* Vite
* TailwindCSS
* TanStack Router & React Query
* Radix UI Components
* Framer Motion

### Backend / Services

* Supabase (Database + Functions)
* Cloudflare Workers (via Wrangler)
* Server runtime (`server.ts`, `start.ts`)

### Validation

* Custom Supabase Edge Function:

  * `supabase/functions/validate-round`

---

## 📁 Project Structure

```
.
├── src/
│   ├── components/
│   │   ├── game/
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── CountdownTimer.tsx
│   │   │   ├── PlayerList.tsx
│   │   ├── ui/
│   ├── hooks/
│   ├── lib/
│   ├── routes/
│   ├── router.tsx
│   ├── routeTree.gen.ts
│   ├── server.ts
│   ├── start.ts
│   └── styles.css
│
├── supabase/
│   ├── functions/
│   │   └── validate-round/
│   ├── migrations/
│   └── config.toml
│
├── .lovable/
├── .env
├── package.json
├── vite.config.ts
├── tsconfig.json
├── wrangler.jsonc
```

---

## ⚙️ Scripts

From :

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
npm run format     # Format code with Prettier
```

---

## 🧑‍💻 Local Development Setup

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd <project-folder>
```

### 2. Install dependencies

```bash
npm install
```

### 3. Setup environment variables

Create a `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

---

### 4. Run the app

```bash
npm run dev
```

---

## 🧠 Game Logic Overview

### 🎮 Gameplay Flow

1. Admin creates game
2. Players join via Game ID
3. Each round:

   * Random letter generated
   * Players fill categories
4. Early finisher triggers countdown
5. Answers validated via Supabase
6. Scores calculated
7. Leaderboard updated

---

### ✅ Validation System

Handled by:

```
supabase/functions/validate-round
```

Validates:

* Real words (no random strings)
* Correct category match
* Duplicate answers across players

---

### 🏆 Scoring System

* ✅ Unique correct answer → Full points
* ⚠️ Duplicate answer → Partial points
* ❌ Invalid answer → 0 points
* ⚡ Fast completion → Bonus

---

## 🌐 Deployment (Free Hosting)

### Frontend

* Deploy via Vercel or Cloudflare Pages

### Backend / Functions

* Supabase (Edge Functions)
* Cloudflare Workers (via Wrangler)

### Steps

1. Push project to GitHub
2. Connect to Vercel
3. Add environment variables
4. Deploy Supabase functions:

```bash
supabase functions deploy validate-round
```

---

## 🎨 Design Philosophy

* Bright, playful UI inspired by Skribbl.io
* Smooth animations using Framer Motion
* Responsive design (mobile + desktop)
* Clean component-based architecture

---

## 🔮 Future Improvements

* 🤖 AI validation fallback
* 🧩 Daily challenges
* 🏅 Achievement system
* 🎥 Streamer mode
* 🔊 Voice chat
* 📊 Global leaderboard

---

## 🤝 Contributing

Pull requests are welcome! Feel free to:

* Improve validation logic
* Add new categories
* Enhance UI/UX

---

## 📄 License

MIT License

---

## 💡 Credits

Built using:

* Lovable.dev
* TanStack ecosystem
* Supabase
* Cloudflare
* Vite

---

## 🎉 Enjoy the Game!

Invite your friends, think fast, and become the ultimate **Letter Legend** 🚀
