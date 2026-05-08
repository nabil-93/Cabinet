"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const TYPE_COLORS = ["#6272f5", "#43e97b", "#f5a623", "#ef4444", "#a18cd1", "#64748b"];

interface TypeEntry {
  type: string;
  count: number;
}

interface Props {
  data: TypeEntry[];
}

export default function ConsultationTypesChart({ data }: Props) {
  const total = data.reduce((s, x) => s + x.count, 0);

  return (
    <div className="grid grid-cols-2 gap-4">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count" nameKey="type"
            cx="50%" cy="50%"
            outerRadius={70} paddingAngle={3}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: any, name: any) => [v, name]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col justify-center gap-2">
        {data.map((t, i) => {
          const pct = total > 0 ? Math.round((t.count / total) * 100) : 0;
          return (
            <div key={t.type} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: TYPE_COLORS[i % TYPE_COLORS.length] }} />
              <span className="text-xs text-muted-foreground flex-1 truncate">{t.type}</span>
              <span className="text-xs font-bold text-foreground">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
