// ============================================================
// Brand colors
// ============================================================

// Brand color - used in JS files where CSS variables aren't available
export const BRAND_COLOR = "#212a3b";
export const BRAND_COLOR_HOVER = "#3d485e";

// ============================================================
// Sample books for the homepage
// ============================================================

export const sampleBooks = [
  {
    _id: "1",
    title: "Clean Code",
    author: "Robert Cecil Martin",
    slug: "clean-code",
    coverURL: "https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg",
    coverColor: "#f8f4e9",
  },
  {
    _id: "2",
    title: "JavaScript: The Definitive Guide",
    author: "David Flanagan",
    slug: "javascript-the-definitive-guide",
    coverURL: "https://covers.openlibrary.org/b/isbn/9780596805524-L.jpg",
    coverColor: "#f8f4e9",
  },
  {
    _id: "3",
    title: "Brave New World",
    author: "Aldous Huxley",
    slug: "brave-new-world",
    coverURL: "https://covers.openlibrary.org/b/isbn/9780060850524-L.jpg",
    coverColor: "#f8f4e9",
  },
  {
    _id: "4",
    title: "Rich Dad Poor Dad",
    author: "Robert Kiyosaki",
    slug: "rich-dad-poor-dad",
    coverURL: "https://covers.openlibrary.org/b/isbn/9781612680194-L.jpg",
    coverColor: "#f8f4e9",
  },
  {
    _id: "5",
    title: "Deep Work",
    author: "Cal Newport",
    slug: "deep-work",
    coverURL: "https://covers.openlibrary.org/b/isbn/9781455586691-L.jpg",
    coverColor: "#f8f4e9",
  },
  {
    _id: "6",
    title: "How to Win Friends and Influence People",
    author: "Dale Carnegie",
    slug: "how-to-win-friends-and-influence-people",
    coverURL: "https://covers.openlibrary.org/b/isbn/9780671027032-L.jpg",
    coverColor: "#f8f4e9",
  },
  {
    _id: "7",
    title: "The Power of Habit",
    author: "Charles Duhigg",
    slug: "the-power-of-habit",
    coverURL: "https://covers.openlibrary.org/b/isbn/9781400069286-L.jpg",
    coverColor: "#f8f4e9",
  },
  {
    _id: "8",
    title: "Atomic Habits",
    author: "James Clear",
    slug: "atomic-habits",
    coverURL: "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg",
    coverColor: "#f8f4e9",
  },
  {
    _id: "9",
    title: "The Courage to Be Disliked",
    author: "Fumitake Koga & Ichiro Kishimi",
    slug: "the-courage-to-be-disliked",
    coverURL: "https://covers.openlibrary.org/b/isbn/9781501197274-L.jpg",
    coverColor: "#f8f4e9",
  },
  {
    _id: "10",
    title: "1984",
    author: "George Orwell",
    slug: "1984",
    coverURL: "https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg",
    coverColor: "#f8f4e9",
  },
];

// ============================================================
// File validation
// ============================================================

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const ACCEPTED_PDF_TYPES = ["application/pdf"];

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

// ============================================================
// Dograh Voice Agent
// ============================================================

// Dograh workflow ID
// Your Dograh workflow:
// https://app.dograh.com/workflow/11722
export const DOGRAH_WORKFLOW_ID = process.env.NEXT_PUBLIC_DOGRAH_WORKFLOW_ID!;

// ============================================================
// Voice options
// ============================================================

// These names are used by the BooklyAI UI.
// The actual voice configuration should be handled
// inside your Dograh workflow.

export const voiceOptions = {
  dave: {
    name: "Dave",
    description: "Young male, British-Essex, casual & conversational",
  },

  daniel: {
    name: "Daniel",
    description: "Middle-aged male, British, authoritative but warm",
  },

  chris: {
    name: "Chris",
    description: "Male, casual & easy-going",
  },

  rachel: {
    name: "Rachel",
    description: "Young female, American, calm & clear",
  },

  sarah: {
    name: "Sarah",
    description: "Young female, American, soft & approachable",
  },
};

// ============================================================
// Voice categories
// ============================================================

export const voiceCategories = {
  male: ["dave", "daniel", "chris"],
  female: ["rachel", "sarah"],
};

// ============================================================
// Default voice
// ============================================================

export const DEFAULT_VOICE = "rachel";

// ============================================================
// Clerk appearance overrides
// Warm Literary Style
// ============================================================

export const CLERK_AUTH_APPEARANCE_OVERRIDE = {
  rootBox: "mx-auto",

  card: "shadow-none border-none rounded-xl bg-transparent",

  headerTitle: "!text-2xl font-bold text-[#212a3b]",

  headerSubtitle: "!mt-3 !text-sm text-[#3d485e]",

  socialButtonsBlockButton:
    "!border border-[rgba(33,42,59,0.12)] hover:bg-[#212a3b]/10 transition-all h-12 text-lg !rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.08)]",

  socialButtonsBlockButtonText: "font-medium !text-[#212a3b] !text-lg",

  formButtonPrimary:
    "bg-[#212a3b] hover:bg-[#3d485e] text-white font-medium !border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.08)] normal-case !h-12 !text-lg !rounded-xl",

  formFieldInput:
    "!border !border-[rgba(33,42,59,0.12)] !rounded-xl focus:ring-[#212a3b] focus:border-[#212a3b] !h-12 !min-h-12 !text-lg !bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.06)]",

  formFieldLabel: "text-[#212a3b] font-medium text-lg",

  footerActionLink: "text-[#212a3b] hover:text-[#3d485e] text-base font-medium",
};
