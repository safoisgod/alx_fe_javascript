// ========== CONFIG ==========
const SERVER_URL = "https://jsonplaceholder.typicode.com/posts"; // JSONPlaceholder for fetch and post
const SYNC_INTERVAL = 30000; // 30 seconds

// ========== DATA HANDLING ==========

function saveQuotes() {
  localStorage.setItem('quotes', JSON.stringify(quotes));
}

function loadQuotes() {
  const stored = localStorage.getItem('quotes');
  return stored ? JSON.parse(stored) : defaultQuotes;
}

function saveLastFilter(category) {
  localStorage.setItem('lastFilter', category);
}

function loadLastFilter() {
  return localStorage.getItem('lastFilter') || 'all';
}

const defaultQuotes = [
  { text: "Life is what happens when you're busy making other plans.", category: "Life" },
  { text: "The only limit to our realization of tomorrow is our doubts of today.", category: "Motivation" },
  { text: "In the middle of every difficulty lies opportunity.", category: "Inspiration" }
];

let quotes = loadQuotes();

// ========== DOM ELEMENTS ==========

const quoteDisplay = document.getElementById('quoteDisplay');
const newQuoteBtn = document.getElementById('newQuote');
const categoryFilter = document.getElementById('categoryFilter');
const notification = document.getElementById('notification');

// ========== UI FUNCTIONS ==========

function showNotification(msg, duration = 3000) {
  notification.textContent = msg;
  notification.style.display = 'block';
  setTimeout(() => notification.style.display = 'none', duration);
}

function createAddQuoteForm() {
  const formDiv = document.getElementById('addQuoteForm');
  formDiv.innerHTML = `
    <input id="newQuoteText" type="text" placeholder="Enter a new quote" />
    <input id="newQuoteCategory" type="text" placeholder="Enter quote category" />
    <button id="addQuoteBtn" onclick="addQuote()">Add Quote</button>
  `;
}

// ========== QUOTE FUNCTIONS ==========

function showRandomQuote() {
  const selectedCategory = categoryFilter.value;
  let filteredQuotes = quotes;

  if (selectedCategory !== "all") {
    filteredQuotes = quotes.filter(q => q.category.toLowerCase() === selectedCategory.toLowerCase());
  }

  if (filteredQuotes.length === 0) {
    quoteDisplay.textContent = "No quotes available for this category.";
    return;
  }

  const randomIndex = Math.floor(Math.random() * filteredQuotes.length);
  const quote = filteredQuotes[randomIndex];

  quoteDisplay.textContent = `"${quote.text}" — ${quote.category}`;
  sessionStorage.setItem('lastQuote', JSON.stringify(quote));
}

function addQuote() {
  const textInput = document.getElementById('newQuoteText');
  const categoryInput = document.getElementById('newQuoteCategory');

  const newText = textInput.value.trim();
  const newCategory = categoryInput.value.trim();

  if (!newText || !newCategory) {
    alert("Both fields are required.");
    return;
  }

  const newQuote = { text: newText, category: newCategory };
  quotes.push(newQuote);
  saveQuotes();
  populateCategories();
  postQuotesToServer(); // Post new quote to server

  textInput.value = "";
  categoryInput.value = "";

  alert("Quote added!");
}

function exportToJson() {
  const dataStr = JSON.stringify(quotes, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "quotes.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importFromJsonFile(event) {
  const fileReader = new FileReader();

  fileReader.onload = function (event) {
    try {
      const importedQuotes = JSON.parse(event.target.result);

      if (!Array.isArray(importedQuotes)) {
        alert("Invalid format: expected an array.");
        return;
      }

      const validQuotes = importedQuotes.filter(
        q => q.text && q.category && typeof q.text === "string" && typeof q.category === "string"
      );

      if (validQuotes.length === 0) {
        alert("No valid quotes found in file.");
        return;
      }

      quotes.push(...validQuotes);
      saveQuotes();
      populateCategories();
      postQuotesToServer(); // Post imported quotes to server
      alert("Quotes imported successfully!");
    } catch (err) {
      alert("Error importing quotes: " + err.message);
    }
  };

  fileReader.readAsText(event.target.files[0]);
}

// ========== FILTERING ==========

function populateCategories() {
  const categories = [...new Set(quotes.map(q => q.category))];
  const currentFilter = loadLastFilter();

  categoryFilter.innerHTML = `<option value="all">All Categories</option>`;
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categoryFilter.appendChild(opt);
  });

  categoryFilter.value = currentFilter;
}

function filterQuotes() {
  const selected = categoryFilter.value;
  saveLastFilter(selected);
  showRandomQuote();
}

// ========== SYNC WITH SERVER ==========

async function fetchQuotesFromServer() {
  try {
    const response = await fetch(SERVER_URL);
    if (!response.ok) throw new Error("Failed to fetch from server.");
    const serverData = await response.json();
    // Map JSONPlaceholder response to quote format
    return serverData.map(item => ({
      text: item.title, // Using 'title' as quote text
      category: item.body.slice(0, 20) // Using first 20 chars of 'body' as category
    }));
  } catch (err) {
    console.warn("Fetch failed:", err.message);
    return []; // Return empty array on failure
  }
}

async function postQuotesToServer() {
  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quotes)
    });
    if (!response.ok) throw new Error("Failed to post to server.");
    await response.json();
    showNotification("Quotes posted to server.");
  } catch (err) {
    console.warn("Post failed:", err.message);
  }
}

async function syncQuotes() {
  try {
    // Fetch quotes from server
    const serverQuotes = await fetchQuotesFromServer();
    // Merge with local quotes
    const updated = mergeServerQuotes(serverQuotes);
    if (updated) {
      populateCategories();
      filterQuotes();
    }
    // Post local quotes to server
    await postQuotesToServer();
  } catch (err) {
    console.warn("Sync failed:", err.message);
  }
}

function mergeServerQuotes(serverQuotes) {
  let localChanged = false;
  let conflictsResolved = false;

  serverQuotes.forEach(serverQuote => {
    const index = quotes.findIndex(q => q.text === serverQuote.text);

    if (index !== -1) {
      if (quotes[index].category !== serverQuote.category) {
        const userChoice = confirm(
          `Conflict detected for quote: "${serverQuote.text}"\n` +
          `Local category: ${quotes[index].category}\n` +
          `Server category: ${serverQuote.category}\n` +
          `Keep server version? (Click OK for server, Cancel for local)`
        );
        if (userChoice) {
          quotes[index] = serverQuote;
          conflictsResolved = true;
        }
        localChanged = true;
      }
    } else {
      quotes.push(serverQuote);
      localChanged = true;
    }
  });

  if (localChanged) {
    saveQuotes();
    showNotification(conflictsResolved ? "Quotes synced with conflicts resolved." : "Quotes synced from server.");
  }

  return localChanged;
}

// ========== RESTORE SESSION ==========

function restoreLastQuote() {
  const last = sessionStorage.getItem('lastQuote');
  if (last) {
    const quote = JSON.parse(last);
    quoteDisplay.textContent = `"${quote.text}" — ${quote.category}`;
  }
}

// ========== INIT ==========

createAddQuoteForm();
newQuoteBtn.addEventListener('click', showRandomQuote);
populateCategories();
filterQuotes();
restoreLastQuote();

// Start periodic server sync
setInterval(syncQuotes, SYNC_INTERVAL);
syncQuotes(); // Initial sync