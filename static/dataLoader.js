const DEFAULT_URL = "/studyData.json";

let cache = null;

function shuffleArray(array) {
  const items = array.slice();
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

async function loadStudyData(url = DEFAULT_URL) {
  if (cache) return cache;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load study data from ${url}: ${response.status} ${response.statusText}`);
  }
  cache = await response.json();
  return cache;
}

function clearCache() {
  cache = null;
}

async function getAll(url = DEFAULT_URL) {
  return loadStudyData(url);
}

async function getCategories(url = DEFAULT_URL) {
  const data = await loadStudyData(url);
  return Object.keys(data);
}

async function getByCategory(category, url = DEFAULT_URL) {
  const data = await loadStudyData(url);
  return Array.isArray(data[category]) ? data[category] : [];
}

async function getRandom(count = 10, url = DEFAULT_URL) {
  const data = await loadStudyData(url);
  const all = Object.values(data).flat();
  const shuffled = shuffleArray(all);
  return count === null || count === undefined ? shuffled : shuffled.slice(0, Math.min(count, shuffled.length));
}

const dataLoader = {
  loadStudyData,
  clearCache,
  getAll,
  getCategories,
  getByCategory,
  getRandom,
  shuffle: shuffleArray,
};

export {
  loadStudyData,
  clearCache,
  getAll,
  getCategories,
  getByCategory,
  getRandom,
  shuffleArray as shuffle,
};

export default dataLoader;

if (typeof window !== "undefined") {
  window.dataLoader = dataLoader;
}
