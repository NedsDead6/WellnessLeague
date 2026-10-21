/** Emojis people can post and react with. The first few are the quick picks. */
export const EMOJIS = [
  "🔥", "💪", "👏", "🙌", "🎉", "😂", "❤️", "🏃", "🧘", "😴", "🥗", "👟",
  "👍", "🙏", "😍", "🤩", "😎", "🥳", "😅", "😬", "🤔", "😮", "😢", "😭",
  "😤", "🤯", "🫡", "💯", "⭐", "🏆", "🥇", "🚀", "⚡", "🌟", "🍕", "🍔",
  "🍺", "🥦", "🍎", "🚴", "🏋️", "🏊", "💤", "📚", "🤝", "👀", "🐐", "💩",
] as const;

export const QUICK_EMOJIS = EMOJIS.slice(0, 12);
