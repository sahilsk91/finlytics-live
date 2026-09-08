import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceDot,
} from "recharts";

const rupees = (paise) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="bg-ink-800 text-white text-xs rounded-lg px-3 py-2 shadow-raised">
      <p className="font-medium mb-0.5">{label}</p>
      {point.total != null && (
        <p className="font-mono tabular text-white/80">Spent: {rupees(point.total)}</p>
      )}
      {point.predicted != null && (
        <p className="font-mono tabular text-mint">Predicted: {rupees(point.predicted)}</p>
      )}
    </div>
  );
}

/**
 * points: [{ month, total }] historical + optionally one trailing point
 *         { month, predicted, lower, upper } for the forecast.
 */
export default function SpendingTrendChart({ history, forecast }) {
  if (!history?.length) return null;

  const data = history.map((h) => ({ month: h.month, total: h.total }));
  if (forecast) {
    data.push({
      month: forecast.month,
      predicted: forecast.predicted,
      lower: forecast.lower,
      upper: forecast.upper,
      band: [forecast.lower, forecast.upper],
    });
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#E5E4DF" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "#6B6F76" }}
          axisLine={{ stroke: "#E5E4DF" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#6B6F76" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `₹${Math.round(v / 100000)}k`}
          width={44}
        />
        <Tooltip content={<CustomTooltip />} />

        {forecast && (
          <Area
            dataKey="band"
            stroke="none"
            fill="#6FE7C4"
            fillOpacity={0.18}
            connectNulls
          />
        )}

        <Line
          type="monotone"
          dataKey="total"
          stroke="#1F6F54"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#1F6F54" }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="predicted"
          stroke="#6FE7C4"
          strokeWidth={2.5}
          strokeDasharray="5 4"
          dot={{ r: 4, fill: "#6FE7C4" }}
          connectNulls
        />

        {forecast && (
          <ReferenceDot
            x={forecast.month}
            y={forecast.predicted}
            r={5}
            fill="#6FE7C4"
            stroke="#175843"
            strokeWidth={1.5}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
