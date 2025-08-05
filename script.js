let words = [];
let currentWordIndex = 0;

// DOM elements
const wordTitle = document.getElementById("wordTitle");
const wordPOS = document.getElementById("wordPOS");
const wordDefinition = document.getElementById("wordDefinition");
const synonymInput = document.getElementById("synonymInput");
const antonymInput = document.getElementById("antonymInput");
const sentenceInput = document.getElementById("sentenceInput");
const feedback = document.getElementById("feedback");
const playBtn = document.getElementById("playAudioBtn");
const icon = document.getElementById("audioIcon");

// Utility: show feedback
function showFeedback(message, type = 'info') {
  if (!feedback) return;
  feedback.className = `alert alert-${type} text-center w-75 mt-3`;
  feedback.textContent = message;
  feedback.classList.remove('d-none');
  setTimeout(() => feedback.classList.add('d-none'), 3000);
}

// Update the displayed word
function updateWord() {
  const newWord = words[currentWordIndex];
  if (!newWord) return;

  wordTitle.textContent = newWord.word;
  wordPOS.textContent = newWord.partOfSpeech || newWord.pos || '';
  wordDefinition.textContent = newWord.definition || '';

  synonymInput.value = "";
  antonymInput.value = "";
  sentenceInput.value = "";
  feedback.classList.add("d-none");
}

// Play audio
playBtn?.addEventListener("click", () => {
  const word = wordTitle?.textContent;
  if (!word) return;

  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  icon.textContent = "🎵";
  icon.classList.add("spin");

  utterance.onend = () => {
    icon.textContent = "🔊";
    icon.classList.remove("spin");
  };

  try {
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  } catch (err) {
    showFeedback("Speech synthesis error.", "danger");
  }
});

// Load vocabulary words
fetch("words.json")
  .then(res => res.json())
  .then(data => {
    words = data;
    currentWordIndex = 0;
    updateWord();
  })
  .catch(err => {
    showFeedback("Failed to load vocabulary.", "danger");
    console.error(err);
  });

// Next word button
document.getElementById("newWordBtn")?.addEventListener("click", () => {
  if (words.length === 0) return;
  currentWordIndex = (currentWordIndex + 1) % words.length;
  updateWord();
  showFeedback('🔁 New word loaded!', 'info');
});

// Synonym check
document.getElementById("synonymForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = synonymInput.value.trim().toLowerCase();
  const word = wordTitle.textContent.trim().toLowerCase();

  if (!input) return showFeedback("❗ Please enter a synonym.", "warning");

  try {
    const res = await fetch(`https://api.datamuse.com/words?rel_syn=${word}`);
    const data = await res.json();
    const synonyms = data.map(obj => obj.word.toLowerCase());
    const isCorrect = synonyms.includes(input);
    showFeedback(isCorrect ? '✅ Correct Synonym!' : '❌ Try again.', isCorrect ? 'success' : 'danger');
  } catch (err) {
    showFeedback("Error fetching synonyms.", "danger");
  }
});

// Antonym check
document.getElementById("antonymForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = antonymInput.value.trim().toLowerCase();
  const word = wordTitle.textContent.trim().toLowerCase();

  if (!input) return showFeedback("❗ Please enter an antonym.", "warning");

  try {
    const res = await fetch(`https://api.datamuse.com/words?rel_ant=${word}`);
    const data = await res.json();
    const antonyms = data.map(obj => obj.word.toLowerCase());
    const isCorrect = antonyms.includes(input);
    showFeedback(isCorrect ? '✅ Correct Antonym!' : '❌ Try again.', isCorrect ? 'success' : 'danger');
  } catch (err) {
    showFeedback("Error fetching antonyms.", "danger");
  }
});

// Sentence submission
document.getElementById("sentenceForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const sentence = sentenceInput.value.trim();
  const word = wordTitle.textContent.trim().toLowerCase();

  if (!sentence.toLowerCase().includes(word)) {
    return showFeedback(`❌ Your sentence must include the word: "${word}"`, 'danger');
  }

  let stored = JSON.parse(localStorage.getItem('sentences')) || [];
  stored.push({ word, sentence });
  localStorage.setItem('sentences', JSON.stringify(stored));

  showFeedback('✅ Sentence submitted successfully!', 'success');
  sentenceInput.value = '';
});

// Chips to autofill input
document.querySelectorAll('.clickable-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const inputId = chip.parentElement.previousElementSibling?.id;
    if (inputId) {
      const input = document.getElementById(inputId);
      if (input) input.value = chip.textContent;
    }
  });
});

// Navbar toggle
document.getElementById('toggleBtn')?.addEventListener('click', () => {
  document.getElementById('navbarLinks')?.classList.toggle('show');
});

document.getElementById('hamburger')?.addEventListener('click', () => {
  document.getElementById('navLinks')?.classList.toggle('active');
});
function validateAnswer(inputId, feedbackId, correctAnswers) {
  const userInput = document.getElementById(inputId).value.trim().toLowerCase();
  const feedback = document.getElementById(feedbackId);

  if (userInput === "") {
    feedback.textContent = "Please type something before submitting!";
    feedback.className = "alert alert-danger mt-2";
  } else if (correctAnswers.includes(userInput)) {
    feedback.textContent = "✅ Great! That's correct.";
    feedback.className = "alert alert-success mt-2";
  } else {
    feedback.textContent = "❌ Not quite. Try again!";
    feedback.className = "alert alert-danger mt-2";
  }
}

function checkSynonym() {
  validateAnswer("synonymInput", "synonymFeedback", ["large", "huge", "massive"]);
}

function checkAntonym() {
  validateAnswer("antonymInput", "antonymFeedback", ["small", "tiny", "little"]);
}

document.querySelectorAll('.clickable-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const inputId = chip.closest('section').querySelector('input').id;
    document.getElementById(inputId).value = chip.textContent;
  });
});
