import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { CATEGORY_COLORS } from "./CategoryBadge";

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { category, amount } = payload[0].payload;
  return (
    <div className="bg-ink-800 text-white text-xs rounded-lg px-3 py-2 shadow-raised">
      <p className="font-medium mb-0.5">{category}</p>
      <p className="font-mono tabular text-white/80">
        {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount / 100)}
      </p>
    </div>
  );
}

export default function CategoryPieChart({ data }) {
  // data: [{ category, amount }]
  if (!data?.length) return null;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="amount"
          nameKey="category"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          strokeWidth={0}
          isAnimationActive={false}
        >
          {data.map((entry) => (
            <Cell
              key={entry.category}
              fill={(CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.Other).fg}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}
