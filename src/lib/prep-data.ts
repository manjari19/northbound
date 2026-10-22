export type Problem = { name: string; slug: string; diff: "Easy" | "Medium" | "Hard"; premium?: boolean };
export type Topic = { topic: string; why: string; problems: Problem[] };

const E = "Easy" as const, M = "Medium" as const, H = "Hard" as const;

/** Blind 75 in learning order, plus a few NeetCode staples where the 75 is thin. */
export const ROADMAP: Topic[] = [
  { topic: "Arrays and hashing", why: "Hash maps turn most O(n²) brute forces into O(n). Learn this first.", problems: [
    { name: "Contains Duplicate", slug: "contains-duplicate", diff: E },
    { name: "Valid Anagram", slug: "valid-anagram", diff: E },
    { name: "Two Sum", slug: "two-sum", diff: E },
    { name: "Group Anagrams", slug: "group-anagrams", diff: M },
    { name: "Top K Frequent Elements", slug: "top-k-frequent-elements", diff: M },
    { name: "Product of Array Except Self", slug: "product-of-array-except-self", diff: M },
    { name: "Encode and Decode Strings", slug: "encode-and-decode-strings", diff: M, premium: true },
    { name: "Longest Consecutive Sequence", slug: "longest-consecutive-sequence", diff: M },
  ]},
  { topic: "Two pointers", why: "Sorted input or a palindrome check usually means two pointers.", problems: [
    { name: "Valid Palindrome", slug: "valid-palindrome", diff: E },
    { name: "3Sum", slug: "3sum", diff: M },
    { name: "Container With Most Water", slug: "container-with-most-water", diff: M },
  ]},
  { topic: "Sliding window", why: "Anything about a contiguous substring or subarray.", problems: [
    { name: "Best Time to Buy and Sell Stock", slug: "best-time-to-buy-and-sell-stock", diff: E },
    { name: "Longest Substring Without Repeating Characters", slug: "longest-substring-without-repeating-characters", diff: M },
    { name: "Longest Repeating Character Replacement", slug: "longest-repeating-character-replacement", diff: M },
    { name: "Minimum Window Substring", slug: "minimum-window-substring", diff: H },
  ]},
  { topic: "Stack", why: "Matching pairs and 'next greater' questions.", problems: [
    { name: "Valid Parentheses", slug: "valid-parentheses", diff: E },
    { name: "Min Stack", slug: "min-stack", diff: M },
    { name: "Daily Temperatures", slug: "daily-temperatures", diff: M },
  ]},
  { topic: "Binary search", why: "If the answer space is sorted, you can halve it.", problems: [
    { name: "Binary Search", slug: "binary-search", diff: E },
    { name: "Find Minimum in Rotated Sorted Array", slug: "find-minimum-in-rotated-sorted-array", diff: M },
    { name: "Search in Rotated Sorted Array", slug: "search-in-rotated-sorted-array", diff: M },
  ]},
  { topic: "Linked list", why: "Pointer handling under pressure. Draw it before you code it.", problems: [
    { name: "Reverse Linked List", slug: "reverse-linked-list", diff: E },
    { name: "Merge Two Sorted Lists", slug: "merge-two-sorted-lists", diff: E },
    { name: "Linked List Cycle", slug: "linked-list-cycle", diff: E },
    { name: "Reorder List", slug: "reorder-list", diff: M },
    { name: "Remove Nth Node From End of List", slug: "remove-nth-node-from-end-of-list", diff: M },
    { name: "Merge k Sorted Lists", slug: "merge-k-sorted-lists", diff: H },
  ]},
  { topic: "Trees", why: "The most common interview topic. Get fluent with recursion here.", problems: [
    { name: "Invert Binary Tree", slug: "invert-binary-tree", diff: E },
    { name: "Maximum Depth of Binary Tree", slug: "maximum-depth-of-binary-tree", diff: E },
    { name: "Same Tree", slug: "same-tree", diff: E },
    { name: "Subtree of Another Tree", slug: "subtree-of-another-tree", diff: E },
    { name: "Lowest Common Ancestor of a BST", slug: "lowest-common-ancestor-of-a-binary-search-tree", diff: M },
    { name: "Binary Tree Level Order Traversal", slug: "binary-tree-level-order-traversal", diff: M },
    { name: "Validate Binary Search Tree", slug: "validate-binary-search-tree", diff: M },
    { name: "Kth Smallest Element in a BST", slug: "kth-smallest-element-in-a-bst", diff: M },
    { name: "Construct Binary Tree from Preorder and Inorder", slug: "construct-binary-tree-from-preorder-and-inorder-traversal", diff: M },
    { name: "Binary Tree Maximum Path Sum", slug: "binary-tree-maximum-path-sum", diff: H },
    { name: "Serialize and Deserialize Binary Tree", slug: "serialize-and-deserialize-binary-tree", diff: H },
  ]},
  { topic: "Tries", why: "Prefix search and autocomplete style problems.", problems: [
    { name: "Implement Trie (Prefix Tree)", slug: "implement-trie-prefix-tree", diff: M },
    { name: "Design Add and Search Words", slug: "design-add-and-search-words-data-structure", diff: M },
    { name: "Word Search II", slug: "word-search-ii", diff: H },
  ]},
  { topic: "Heaps", why: "Whenever you need the top k or a running median.", problems: [
    { name: "Kth Largest Element in a Stream", slug: "kth-largest-element-in-a-stream", diff: E },
    { name: "Find Median from Data Stream", slug: "find-median-from-data-stream", diff: H },
  ]},
  { topic: "Backtracking", why: "Generate every option, prune the bad ones early.", problems: [
    { name: "Subsets", slug: "subsets", diff: M },
    { name: "Combination Sum", slug: "combination-sum", diff: M },
    { name: "Word Search", slug: "word-search", diff: M },
  ]},
  { topic: "Graphs", why: "BFS, DFS and topological sort. Grids count as graphs.", problems: [
    { name: "Number of Islands", slug: "number-of-islands", diff: M },
    { name: "Clone Graph", slug: "clone-graph", diff: M },
    { name: "Pacific Atlantic Water Flow", slug: "pacific-atlantic-water-flow", diff: M },
    { name: "Course Schedule", slug: "course-schedule", diff: M },
    { name: "Number of Connected Components", slug: "number-of-connected-components-in-an-undirected-graph", diff: M, premium: true },
    { name: "Graph Valid Tree", slug: "graph-valid-tree", diff: M, premium: true },
    { name: "Alien Dictionary", slug: "alien-dictionary", diff: H, premium: true },
  ]},
  { topic: "1-D dynamic programming", why: "Write the recursion first, then cache it.", problems: [
    { name: "Climbing Stairs", slug: "climbing-stairs", diff: E },
    { name: "House Robber", slug: "house-robber", diff: M },
    { name: "House Robber II", slug: "house-robber-ii", diff: M },
    { name: "Longest Palindromic Substring", slug: "longest-palindromic-substring", diff: M },
    { name: "Palindromic Substrings", slug: "palindromic-substrings", diff: M },
    { name: "Decode Ways", slug: "decode-ways", diff: M },
    { name: "Coin Change", slug: "coin-change", diff: M },
    { name: "Maximum Product Subarray", slug: "maximum-product-subarray", diff: M },
    { name: "Word Break", slug: "word-break", diff: M },
    { name: "Longest Increasing Subsequence", slug: "longest-increasing-subsequence", diff: M },
  ]},
  { topic: "2-D dynamic programming", why: "Same idea with a grid of states.", problems: [
    { name: "Unique Paths", slug: "unique-paths", diff: M },
    { name: "Longest Common Subsequence", slug: "longest-common-subsequence", diff: M },
  ]},
  { topic: "Greedy", why: "Make the locally best choice, then convince yourself it's safe.", problems: [
    { name: "Maximum Subarray", slug: "maximum-subarray", diff: M },
    { name: "Jump Game", slug: "jump-game", diff: M },
  ]},
  { topic: "Intervals", why: "Sort by start time. That's usually most of the trick.", problems: [
    { name: "Insert Interval", slug: "insert-interval", diff: M },
    { name: "Merge Intervals", slug: "merge-intervals", diff: M },
    { name: "Non-overlapping Intervals", slug: "non-overlapping-intervals", diff: M },
    { name: "Meeting Rooms", slug: "meeting-rooms", diff: E, premium: true },
    { name: "Meeting Rooms II", slug: "meeting-rooms-ii", diff: M, premium: true },
  ]},
  { topic: "Matrix", why: "Index bookkeeping. Rarely hard, often fiddly.", problems: [
    { name: "Rotate Image", slug: "rotate-image", diff: M },
    { name: "Spiral Matrix", slug: "spiral-matrix", diff: M },
    { name: "Set Matrix Zeroes", slug: "set-matrix-zeroes", diff: M },
  ]},
  { topic: "Bit manipulation", why: "Short, and it shows up in phone screens.", problems: [
    { name: "Number of 1 Bits", slug: "number-of-1-bits", diff: E },
    { name: "Counting Bits", slug: "counting-bits", diff: E },
    { name: "Reverse Bits", slug: "reverse-bits", diff: E },
    { name: "Missing Number", slug: "missing-number", diff: E },
    { name: "Sum of Two Integers", slug: "sum-of-two-integers", diff: M },
  ]},
];

export const ALL_PROBLEMS = ROADMAP.flatMap((t) => t.problems.map((p) => ({ ...p, topic: t.topic })));

export type Question = { id: string; q: string; look: string };
export type Theme = { theme: string; questions: Question[] };

export const BEHAVIORAL: Theme[] = [
  { theme: "Your story", questions: [
    { id: "intro", q: "Tell me about yourself.", look: "Ninety seconds: what you study, one or two things you built, why this role is the next step." },
    { id: "why-co", q: "Why this company?", look: "Something specific about their product or engineering, tied to something you've actually done." },
    { id: "why-role", q: "Why do you want this internship?", look: "What you want to learn, and why their team is where you'd learn it." },
  ]},
  { theme: "Working with people", questions: [
    { id: "disagree", q: "Tell me about a time you disagreed with a teammate.", look: "You listened, used evidence, and the relationship survived. Who was right matters less." },
    { id: "difficult", q: "Describe working with someone who was hard to work with.", look: "Empathy for their side, a concrete thing you changed, no trash talk." },
    { id: "rely", q: "Tell me about a time you depended on others to finish something.", look: "How you kept things visible and unblocked people without taking over." },
  ]},
  { theme: "Mistakes and feedback", questions: [
    { id: "fail", q: "Tell me about a time you failed.", look: "A real miss you owned, what you changed afterward, and proof the change stuck." },
    { id: "feedback", q: "Tell me about feedback that was hard to hear.", look: "You didn't get defensive, and you can name what you do differently now." },
    { id: "mistake", q: "Describe a mistake you made and how you fixed it.", look: "Fast disclosure, a clean fix, and a guardrail so it doesn't happen again." },
  ]},
  { theme: "Ownership", questions: [
    { id: "ownership", q: "Tell me about a time you took ownership of something outside your role.", look: "You noticed a gap nobody owned and closed it without being asked." },
    { id: "lead", q: "Tell me about leading a group without formal authority.", look: "How you got buy-in: clarity, doing the boring parts, making others look good." },
    { id: "improve", q: "Tell me about something you improved without being asked.", look: "A before and after with a number attached, even a rough one." },
  ]},
  { theme: "Pressure and ambiguity", questions: [
    { id: "deadline", q: "Tell me about working under a tight deadline.", look: "What you cut, what you protected, and how you communicated the trade-off." },
    { id: "ambiguous", q: "Describe a time the requirements were unclear.", look: "You asked good questions, made a reasonable assumption, and checked it early." },
    { id: "priorities", q: "Tell me about juggling competing priorities.", look: "A visible way of deciding, not heroics. Who you told and when." },
  ]},
  { theme: "Technical depth", questions: [
    { id: "learn", q: "Tell me about learning a new technology quickly.", look: "Your actual learning loop: docs, small experiments, asking the right person." },
    { id: "hardest", q: "What's the most technically challenging thing you've built?", look: "Be ready for three levels of 'why'. Know the trade-offs you made and what you'd change." },
  ]},
];

export const ALL_QUESTIONS = BEHAVIORAL.flatMap((t) => t.questions);

export const RESOURCES = [
  { name: "NeetCode roadmap", url: "https://neetcode.io/roadmap", note: "Video walkthroughs for every problem above, free. Also has the premium-only ones." },
  { name: "Tech Interview Handbook", url: "https://www.techinterviewhandbook.org/", note: "Free guide covering coding patterns, behavioral prep and résumés." },
  { name: "LeetCode", url: "https://leetcode.com/problemset/", note: "Where you actually do the problems. Company tags are worth it during recruiting season." },
  { name: "Big-O Cheat Sheet", url: "https://www.bigocheatsheet.com/", note: "Quick complexity reference for the night before." },
  { name: "Levels.fyi internships", url: "https://www.levels.fyi/internships/", note: "Intern pay by company, useful when comparing offers." },
  { name: "SFU myExperience", url: "https://myexperience.sfu.ca/", note: "SFU co-op postings, which the scraper can't see. Check it alongside this board." },
];

export type Checklist = { id: string; name: string; items: { id: string; text: string }[] };

export const CHECKLISTS: Checklist[] = [
  { id: "resume", name: "Résumé", items: [
    { id: "r1", text: "One page, and it fills the page" },
    { id: "r2", text: "Education sits right under the heading" },
    { id: "r3", text: "Projects and roles are newest first" },
    { id: "r4", text: "Every bullet passes the bullet checker above" },
    { id: "r5", text: "No em dashes or semicolons anywhere" },
    { id: "r6", text: "Dates use one consistent format" },
    { id: "r7", text: "GitHub, portfolio and LinkedIn links are clickable" },
    { id: "r8", text: "Single column, no tables or text boxes, so ATS parsers can read it" },
    { id: "r9", text: "Saved as First-Last-Resume.pdf" },
  ]},
  { id: "linkedin", name: "LinkedIn", items: [
    { id: "l1", text: "Headline says what you do and what you're looking for" },
    { id: "l2", text: "Custom profile URL" },
    { id: "l3", text: "Clear, recent photo" },
    { id: "l4", text: "About section is three or four plain lines, not a cover letter" },
    { id: "l5", text: "Experience bullets match your résumé" },
    { id: "l6", text: "Top three skills match the roles you're applying for" },
    { id: "l7", text: "Open to Work is visible to recruiters only" },
    { id: "l8", text: "Best projects are in Featured" },
  ]},
  { id: "github", name: "GitHub", items: [
    { id: "g1", text: "Profile README with one line about you and what you're building" },
    { id: "g2", text: "Four to six of your best repos are pinned" },
    { id: "g3", text: "Each pinned repo has a README: what, why, how to run, a screenshot" },
    { id: "g4", text: "Repo descriptions and topics are filled in" },
    { id: "g5", text: "Live demo links where they exist" },
    { id: "g6", text: "No half-finished tutorial repos pinned" },
    { id: "g7", text: "No secrets or .env files committed" },
  ]},
  { id: "site", name: "Portfolio", items: [
    { id: "s1", text: "Loads in under two seconds" },
    { id: "s2", text: "Projects come first, each with the outcome and a link" },
    { id: "s3", text: "Works well on a phone" },
    { id: "s4", text: "Links to your résumé PDF" },
    { id: "s5", text: "Contact info is easy to find" },
    { id: "s6", text: "No placeholder text or dead links" },
    { id: "s7", text: "Matches what your résumé says" },
  ]},
];
