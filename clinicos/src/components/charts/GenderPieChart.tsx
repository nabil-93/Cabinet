"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const GENDER_COLORS = ["#6272f5", "#43e97b", "#f5a623"];

interface GenderEntry {
  name: string;
  value: number;
  pct: number;
}

interface Props {
  data: GenderEntry[];
}

export default function GenderPieChart({ data }: Props) {
  return (
    <>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={data}
            cx="50%" cy="50%"
            innerRadius={45} outerRadius={65}
            paddingAngle={4} dataKey="value"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: any, _name: any, props: any) => [`${props.payload.pct}% (${v})`, props.payload.name]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-4 mt-2">
        {data.map((g, i) => (
          <div key={g.name} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: GENDER_COLORS[i % GENDER_COLORS.length] }} />
            <span className="text-muted-foreground">{g.name}: <strong className="text-foreground">{g.pct}%</strong></span>
          </div>
        ))}
      </div>
    </>
  );
}
