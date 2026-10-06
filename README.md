# 🧭 AuraGuide

AuraGuide is a cutting-edge, location-aware audio tour application that dynamically tracks 800+ small, local places (temples, hills, falls, parks, and monuments) in a 50km radius around you and uses AI to generate real-time historical and cultural audio narratives in 8 local languages.

## How to run this project independently

If you ever want to run this app on your own computer without an AI agent, just follow these simple steps!

### Prerequisites
1. **Node.js**: You need to have Node.js installed on your computer. You can download it from [nodejs.org](https://nodejs.org/).
2. **OpenAI API Key (Optional but highly recommended)**: For the absolute best storytelling and realistic cloud-generated voices, you will need an OpenAI API Key. (If you don't have one, the app will gracefully fall back to Wikipedia facts and your browser's native robotic voice).

### Step-by-Step Setup

1. **Open your Terminal / Command Prompt**
2. **Navigate to the project folder:**
   ```bash
   cd C:\Users\navya.ramanandabhat\.gemini\antigravity-ide\scratch\AuraGuide
   ```
3. **Install the dependencies:**
   (This downloads all the necessary packages like Next.js, React, and Zustand).
   ```bash
   npm install
   ```
4. **Set up your Environment Variables:**
   Create a file named `.env.local` inside the `AuraGuide` folder and add your OpenAI API Key like this:
   ```env
   OPENAI_API_KEY="sk-your-secret-api-key-here"
   ```
5. **Start the Development Server:**
   ```bash
   npm run dev
   ```
6. **Open the App:**
   Open your web browser (Chrome, Safari, Edge) and go to:
   http://localhost:3000

### Troubleshooting
- **Port in Use:** If it says "Port 3000 is already in use", you can run `npm run dev -- -p 3001` to start it on port 3001 instead.
- **Location Services:** Because this is a live GPS radar app, your browser will ask for Location Permissions. You **must** click "Allow" for the map to work!
