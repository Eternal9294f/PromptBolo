# PromptBolo

PromptBolo is a voice-to-prompt concept for ChatGPT Mobile users in India. It supports Hinglish voice input, live transcription, inline corrections, and structured prompt drafting, giving users more control over how they create and send prompts.

> **Turn rough, casual thoughts and Hinglish ideas into clean, structured prompts for AI.**

[![Live Demo](https://img.shields.io/badge/Demo-Live_on_Render-2ea44f?style=for-the-badge&logo=render)](https://promptbolo0.onrender.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-5.3-000000?style=for-the-badge&logo=express)](https://expressjs.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

---

## 💡 About the Project

When brainstorming, people rarely think in formal, structured English. For bilingual builders in India and across the world, ideas flow naturally in casual language, code-switching, or **Hinglish**:

> *"Yaar, ek simple habit tracker banana hai jo log actually daily use karein. Thoda gentle reminders chahiye..."*

Turning that rough thought into an effective, structured prompt for an LLM (like ChatGPT or Claude) usually takes extra effort and rewriting. 

**PromptBolo** simplifies this. You type your idea in your own words—messy, stream-of-consciousness, or Hinglish—and PromptBolo transforms it into a clear, high-quality prompt tailored to your goal.

---

## 🚀 Features

- **Hinglish & Casual Thought Input:** Understands conversational phrasing and extracts the underlying intent without losing your original context.
- **Goal-Oriented Modes:**
  - **SaaS:** Structures requirements, user roles, features, and constraints.
  - **Creator:** Focuses on audience, tone, format, and storytelling.
  - **Weekend Build:** Scopes ideas down to a realistic MVP and finish line.
  - **General:** Clean structural polish for any topic.
- **Side-by-Side Comparison:** Compare your original rough draft directly against the polished output.
- **Local Drafts History:** Automatically saves recent thoughts in browser local storage.
- **One-Click Copy:** Easily copy your polished prompt to the clipboard.
- **Experimental Voice Input:** An initial integration exploring browser-based speech input (currently under active development).

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Radix UI primitives.
- **Backend:** Node.js, Express 5, TypeScript.
- **AI Processing:** OpenAI API with rate limiting and structured refinement guidance.
- **Deployment:** Render (Full-stack Web Service).

---

## 💻 Running Locally

If you'd like to run this project on your own machine:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Eternal9294f/PromptBolo.git
   cd PromptBolo
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory:
   ```env
   NODE_ENV=development
   PORT=5000
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. **Build and start the application:**
   ```bash
   pnpm run build
   pnpm start
   ```
   Open `http://localhost:5000` in your browser.

---

## 📌 Milestone Context
Built as part of **Milestone 3** in building end-to-end web applications with AI workflows.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
