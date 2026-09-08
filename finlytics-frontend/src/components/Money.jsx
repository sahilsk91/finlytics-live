/**
 * Renders a paise-integer amount as a rupee figure in the app's signature
 * mono/tabular treatment. `sign` controls color: "auto" reads the number's
 * own sign, "flag" forces the amber anomaly color regardless of sign.
 */
export default function Money({ paise, sign = "auto", size = "base", className = "" }) {
  const rupees = paise / 100;
  const isNegative = rupees < 0;

  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: rupees % 1 === 0 ? 0 : 2,
  }).format(Math.abs(rupees));

  const sizes = {
    sm: "text-sm",
    base: "text-base",
    lg: "text-xl",
    xl: "text-3xl",
    "2xl": "text-4xl",
  };

  const colorClass =
    sign === "flag"
      ? "text-amber"
      : isNegative
      ? "text-ink"
      : "text-ledger-600";

  return (
    <span className={`font-mono tabular ${sizes[size]} ${colorClass} ${className}`}>
      {isNegative ? "\u2212" : ""}
      {formatted}
    </span>
  );
}
