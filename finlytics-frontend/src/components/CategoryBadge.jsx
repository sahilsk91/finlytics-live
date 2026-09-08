export const CATEGORY_COLORS = {
  Food: { bg: "#FDEEE0", fg: "#B4591A" },
  Travel: { bg: "#E6F0FB", fg: "#1D5FA8" },
  Bills: { bg: "#F1EAFB", fg: "#6438B0" },
  Shopping: { bg: "#FBE9EE", fg: "#B23A5C" },
  Entertainment: { bg: "#FEF3D6", fg: "#9A7508" },
  Health: { bg: "#E7F6EF", fg: "#1F6F54" },
  Other: { bg: "#EEEEEC", fg: "#5B5E63" },
  Uncategorized: { bg: "#F3F3F1", fg: "#9A9DA3" },
};

export default function CategoryBadge({ category }) {
  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.Other;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: colors.bg, color: colors.fg }}
    >
      {category}
    </span>
  );
}
