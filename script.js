// script.js

// When user clicks "Send"
async function getCompletion() {
  const input = document.querySelector("#message");
  const chatArea = document.querySelector("#chatArea");
  const userMessage = input.value.trim();
  if (!userMessage) return;

  // Display user message
  addMessage(userMessage, "user");

  // Clear input box
  input.value = "";

  // Show "Thinking..." while waiting
  const thinkingBubble = addMessage("Thinking...", "bot");

  try {
    // Send message to backend
    const response = await fetch("http://localhost:5000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage }),
    });

    // Get AI reply
    const data = await response.json();
    const output = data.reply || "Sorry, I couldn’t get a response.";

    // Replace "Thinking..." with the actual reply
    thinkingBubble.textContent = output;

    // Speak the AI’s reply aloud
    speak(output);

    // Auto-scroll chat area
    chatArea.scrollTop = chatArea.scrollHeight;

  } catch (error) {
    thinkingBubble.textContent = "Error: Could not get a response.";
    console.error("Error:", error);
  }
}

// Utility function to add a message bubble
function addMessage(text, sender) {
  const chatArea = document.querySelector("#chatArea");
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message", sender);
  msgDiv.textContent = text;
  chatArea.appendChild(msgDiv);
  chatArea.scrollTop = chatArea.scrollHeight;
  return msgDiv;
}

// Speak text using the browser’s speech synthesis
function speak(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-IN"; // Indian English accent
  utterance.rate = 1;
  speechSynthesis.speak(utterance);
}

// Disable right-click to prevent code copying
// document.addEventListener("contextmenu", function(event) {
//   event.preventDefault();
//   alert("Right-click is disabled on this page!");
// });
