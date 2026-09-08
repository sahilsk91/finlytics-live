import Money from "./Money";

export default function ForecastCard({ forecast }) {
  if (!forecast?.available) {
    return (
      <div className="text-center py-8">
        <p className="font-display text-lg text-ink mb-1.5">Not enough history yet</p>
        <p className="text-sm text-muted max-w-xs mx-auto">
          {forecast?.reason || "Keep tracking a few more months and a forecast will show up here."}
        </p>
      </div>
    );
  }

  const { forecast: f } = forecast;

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted mb-2">
        Predicted spend, {f.month}
      </p>
      <Money paise={f.predicted} size="2xl" />
      <p className="text-sm text-muted mt-2">
        Likely between{" "}
        <Money paise={f.lower} size="sm" className="!text-muted" /> and{" "}
        <Money paise={f.upper} size="sm" className="!text-muted" />
      </p>
    </div>
  );
}
