/**
 * Run this script to test the /api/narrate backend route!
 * First, ensure your Next.js server is running (npm run dev)
 * Then, in a new terminal, run: node test-backend.js
 */

async function testBackend() {
  console.log("Sending test request to http://localhost:3000/api/narrate...");
  
  try {
    const response = await fetch("http://localhost:3000/api/narrate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        poi: {
          name: "The Louvre",
          type: "Museum"
        },
        preferences: {
          topics: ["history", "art"]
        }
      })
    });

    if (response.ok) {
      console.log("✅ Success! The API successfully returned an audio buffer.");
      console.log("Content-Type:", response.headers.get('content-type'));
      console.log("Content-Length:", response.headers.get('content-length'), "bytes");
    } else {
      const errorText = await response.text();
      console.error("❌ Failed. Status:", response.status);
      console.error("Error details:", errorText);
    }
  } catch (err) {
    console.error("❌ Network or Server Error:", err.message);
    console.error("Make sure `npm run dev` is running!");
  }
}

testBackend();
